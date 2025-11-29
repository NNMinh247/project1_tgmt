# 📸 Intelligent Document Scanner AI

Ứng dụng web Fullstack hỗ trợ số hóa tài liệu (OCR Pre-processing). Hệ thống sử dụng Computer Vision để tự động phát hiện, cắt và chỉnh sửa góc nghiêng (Deskewing) của văn bản chụp từ camera, đồng thời tính toán góc quay 3D.

## 🚀 Tính năng nổi bật
1. **Auto Detect (Tự động):**
   - Sử dụng thuật toán **Adaptive Threshold** & **Canny Edge** để phát hiện tất cả các vùng giấy tờ trong ảnh.
   - Bộ lọc thông minh loại bỏ nhiễu và các khung hình lồng nhau.
   - Hỗ trợ chọn đối tượng tương tác (Click to Warp).
2. **Manual Adjust (Thủ công):**
   - Cho phép người dùng kéo thả 4 điểm neo (Anchor Points) để cắt chính xác.
3. **3D Pose Estimation:**
   - Tính toán góc quay 3D thực tế của tờ giấy: **Roll** (Xoay), **Pitch** (Ngửa), **Yaw** (Lật) sử dụng thuật toán **PnP (Perspective-n-Point)**.

## 🛠️ Công nghệ sử dụng
- **Backend:** Python, FastAPI, OpenCV, NumPy.
- **Frontend:** ReactJS (Vite), CSS3 (Modern UI).
- **Computer Vision:** Perspective Transform, Contour Detection, PnP Solver.

## ⚙️ Hướng dẫn cài đặt & Chạy

Yêu cầu: Máy đã cài [Python](https://www.python.org/) và [Node.js](https://nodejs.org/).

### 1. Khởi chạy Backend (Server)
Mở terminal và trỏ vào thư mục `backend`:

```bash
cd backend

# Tạo môi trường ảo (Khuyến nghị)
python -m venv venv
# Kích hoạt môi trường:
# - Windows:
venv\Scripts\activate
# - Mac/Linux:
# source venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy Server
uvicorn main:app --reload
```

Server sẽ chạy tại: http://127.0.0.1:8000

## 2. Khởi chạy Frontend (Client)
Mở một terminal mới và trỏ vào thư mục `frontend`:

```Bash

cd frontend

# Cài đặt các gói Node modules
npm install

# Chạy ứng dụng
npm run dev
```
Truy cập Web tại: http://localhost:5173
```
📂 Cấu trúc dự án
project1_deskew/
├── backend/            # Xử lý ảnh & API
│   ├── main.py         # Logic chính (FastAPI + OpenCV)
│   └── requirements.txt
├── frontend/           # Giao diện người dùng
│   ├── src/
│   │   ├── App.jsx     # Logic hiển thị & Canvas
│   │   └── App.css     # Styles
│   └── package.json
└── README.md           # Tài liệu hướng dẫn
```