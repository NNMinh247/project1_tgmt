import cv2
import numpy as np
import base64
import math
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str
    points: List[List[float]] = []
    action: str = "warp"

def base64_to_cv2(b64str):
    encoded_data = b64str.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def cv2_to_base64(img):
    _, buffer = cv2.imencode('.jpg', img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

# --- 3D POSE ---
def rotation_matrix_to_euler_angles(R):
    sy = math.sqrt(R[0, 0] * R[0, 0] + R[1, 0] * R[1, 0])
    singular = sy < 1e-6
    if not singular:
        x = math.atan2(R[2, 1], R[2, 2])
        y = math.atan2(-R[2, 0], sy)
        z = math.atan2(R[1, 0], R[0, 0])
    else:
        x = math.atan2(-R[1, 2], R[1, 1])
        y = math.atan2(-R[2, 0], sy)
        z = 0
    return np.array([math.degrees(x), math.degrees(y), math.degrees(z)])

def calculate_3d_pose(image_size, corners):
    try:
        focal_length = image_size[1]
        center = (image_size[1] / 2, image_size[0] / 2)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]], 
            dtype="double"
        )
        dist_coeffs = np.zeros((4, 1))
        object_points = np.array([
            [0, 0, 0], [21.0, 0, 0], [21.0, 29.7, 0], [0, 29.7, 0]
        ], dtype="double")

        success, rotation_vector, translation_vector = cv2.solvePnP(
            object_points, corners.astype("double"), camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
        )
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
        euler = rotation_matrix_to_euler_angles(rotation_matrix)
        
        return {
            "pitch_x": round(euler[0], 2),
            "yaw_y":   round(euler[1], 2),
            "roll_z":  round(euler[2], 2)
        }
    except:
        return {"pitch_x": 0, "yaw_y": 0, "roll_z": 0}

# --- TRANSFORM ---
def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(np.array(pts, dtype="float32"))
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([[0, 0], [maxWidth - 1, 0], [maxWidth - 1, maxHeight - 1], [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (maxWidth, maxHeight)), rect

# --- CRITICAL FIX: LOGIC LỌC TRÙNG LẶP ---
def filter_polygons(polygons):
    if not polygons: return []
    
    # 1. Lấy thông tin bounding box
    boxes = []
    for poly in polygons:
        poly_np = np.array(poly, dtype=np.int32)
        x, y, w, h = cv2.boundingRect(poly_np)
        cx, cy = x + w/2, y + h/2
        area = w * h
        boxes.append({'poly': poly, 'rect': (x,y,w,h), 'area': area, 'center': (cx, cy)})

    # 2. Sắp xếp từ LỚN đến NHỎ (Quan trọng: Để xét thằng to trước)
    boxes.sort(key=lambda b: b['area'], reverse=True)
    
    keep = []
    
    for i in range(len(boxes)):
        current = boxes[i]
        is_valid = True
        
        for kept in keep:
            # KIỂM TRA 1: LỒNG NHAU (CONTAINMENT)
            # Nếu tâm của thằng hiện tại (nhỏ hơn) nằm trong thằng đã giữ (to hơn)
            # -> Nó là văn bản con -> Bỏ
            cx, cy = current['center']
            kx, ky, kw, kh = kept['rect']
            
            if (kx < cx < kx + kw) and (ky < cy < ky + kh):
                is_valid = False
                break
                
            # KIỂM TRA 2: QUÁ GẦN NHAU (DUPLICATE)
            # Nếu tâm 2 thằng cách nhau < 20px -> Trùng -> Bỏ
            dist = math.sqrt((cx - kept['center'][0])**2 + (cy - kept['center'][1])**2)
            if dist < 20:
                is_valid = False
                break

        if is_valid:
            keep.append(current)

    return [k['poly'] for k in keep]

# --- DETECTION LOGIC (QUAY VỀ CANNY EDGE MẠNH MẼ) ---
def detect_all_documents(image):
    PROCESS_H = 1000 # Giữ độ phân giải cao
    ratio = image.shape[0] / PROCESS_H
    image_resized = cv2.resize(image, (int(image.shape[1] / ratio), PROCESS_H))
    
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)
    
    # GaussianBlur chuẩn
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Dùng Canny với ngưỡng thấp để bắt hết biên giấy
    edged = cv2.Canny(blur, 10, 200)

    # Dilation mạnh để nối liền nét đứt
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edged, kernel, iterations=3)
    
    cnts, _ = cv2.findContours(dilated.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    candidates = []
    img_area = image_resized.shape[0] * image_resized.shape[1]

    for c in cnts:
        area = cv2.contourArea(c)
        # Lọc rác nhỏ (<0.5%) và lọc cái bảng to đùng (>90%)
        if area < (img_area * 0.005) or area > (img_area * 0.90): 
            continue
            
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.04 * peri, True)

        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = approx.reshape(4, 2) * ratio
            candidates.append(pts.tolist())

    # Gọi bộ lọc mới
    return filter_polygons(candidates)

@app.post("/process")
async def process_image(data: ImageRequest):
    try:
        img = base64_to_cv2(data.image)
        h, w = img.shape[:2]

        if data.action == "detect":
            candidates = detect_all_documents(img)
            return {"candidates": candidates}

        elif data.action == "warp":
            if not data.points or len(data.points) != 4:
                return {"error": "Need 4 points."}
            
            processed_img, ordered_pts = four_point_transform(img, data.points)
            angles = calculate_3d_pose((h, w), ordered_pts)

            return {
                "processed_image": cv2_to_base64(processed_img),
                "angle_info": angles
            }
            
    except Exception as e:
        return {"error": str(e)}