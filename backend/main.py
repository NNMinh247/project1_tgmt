import cv2
import numpy as np
import base64
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageRequest(BaseModel):
    image: str
    points: List[List[float]] = []
    action: str = "detect"
    threshold1: int = 75
    threshold2: int = 200
    morph_kernel: int = 5
    resize_width: int = 600
    filter_dist: int = 20

def base64_to_cv2(b64str):
    encoded_data = b64str.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def cv2_to_base64(img):
    _, buffer = cv2.imencode('.jpg', img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

def order_points(pts):
    xSorted = pts[np.argsort(pts[:, 0]), :]

    leftMost = xSorted[:2, :]
    rightMost = xSorted[2:, :]

    leftMost = leftMost[np.argsort(leftMost[:, 1]), :]
    (tl, bl) = leftMost

    rightMost = rightMost[np.argsort(rightMost[:, 1]), :]
    (tr, br) = rightMost

    return np.array([tl, tr, br, bl], dtype="float32")

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
    return cv2.warpPerspective(image, M, (maxWidth, maxHeight))

def filter_outer_polygons(candidates, dist_threshold):
    if not candidates: return []

    candidates.sort(key=lambda p: cv2.contourArea(np.array(p, dtype=np.float32)), reverse=True)
    
    keep = []
    
    for curr in candidates:
        curr_np = np.array(curr, dtype=np.float32)
        curr_center = np.mean(curr_np, axis=0) 
        
        is_invalid = False
        
        for kept in keep:
            kept_np = np.array(kept, dtype=np.float32)
            
            if cv2.pointPolygonTest(kept_np, tuple(curr_center), False) >= 0:
                is_invalid = True 
                break
                
            kept_center = np.mean(kept_np, axis=0)
            dist = np.linalg.norm(curr_center - kept_center)
            
            if dist < dist_threshold:
                is_invalid = True 
                break
        
        if not is_invalid:
            keep.append(curr)
            
    return keep

def find_all_documents(image, t1, t2, morph_k, width_target, filter_dist):
    (h, w) = image.shape[:2]
    ratio = width_target / float(w)
    dim = (width_target, int(h * ratio))
    image_resized = cv2.resize(image, dim)
    
    gray = cv2.cvtColor(image_resized, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, t1, t2)
    
    if morph_k % 2 == 0: morph_k += 1 
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (morph_k, morph_k)) #MORPH_CROSS
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, kernel)
    
    cnts, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    raw_candidates = []
    img_area = image_resized.shape[0] * image_resized.shape[1]

    for c in cnts:
        area = cv2.contourArea(c)
        if area < (img_area * 0.01) or area > (img_area * 0.98):
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True) #Ramer–Douglas–Peucker_algorithm
        
        if len(approx) == 4 and cv2.isContourConvex(approx):
            real_points = approx.reshape(4, 2) / ratio
            raw_candidates.append(real_points.tolist())
    
    filtered_candidates = filter_outer_polygons(raw_candidates, filter_dist)
            
    return filtered_candidates, closed

@app.post("/process")
async def process_image(data: ImageRequest):
    try:
        img = base64_to_cv2(data.image)
        
        if data.action == "detect":
            candidates, edge_img = find_all_documents(
                img, data.threshold1, data.threshold2, 
                data.morph_kernel, data.resize_width,
                data.filter_dist
            )
            
            return {
                "candidates": candidates,
                "edge_image": cv2_to_base64(edge_img)
            }

        elif data.action == "warp":
            processed_img = four_point_transform(img, data.points)
            return { "processed_image": cv2_to_base64(processed_img) }
            
    except Exception as e:
        return {"error": str(e)}