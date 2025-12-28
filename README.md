# 📸 Intelligent Document Scanner AI

Ứng dụng web Fullstack hỗ trợ số hóa tài liệu (OCR Pre-processing). Hệ thống sử dụng Computer Vision để tự động phát hiện văn bản, cho phép tinh chỉnh tham số thời gian thực và thực hiện cắt/chỉnh nghiêng (Perspective Transform) ngay trên trình duyệt.

## 🚀 Tính năng nổi bật (Cập nhật theo Source Code)

### 1. Real-time Edge Detection & Tuning (Tinh chỉnh thời gian thực)
Khác với các ứng dụng cứng nhắc, hệ thống cho phép người dùng can thiệp trực tiếp vào quá trình xử lý ảnh thông qua bộ điều khiển (Control Panel):
- **Threshold 1 & 2:** Điều chỉnh ngưỡng của thuật toán Canny để bắt cạnh chính xác trong các điều kiện ánh sáng khác nhau.
- **Morph Kernel:** Tăng/giảm độ dày nét liền mạch để nối các cạnh bị đứt gãy.
- **Resize Width:** Cân bằng giữa tốc độ xử lý và độ chi tiết của ảnh đầu vào.
- **Edge Preview:** Xem trước kết quả tách cạnh (Edge Map) ngay lập tức để tìm thông số tối ưu.

### 2. Smart Document Detection (Tự động phát hiện)
- **Core Algorithm:** Sử dụng `Canny Edge Detection` kết hợp với `Morphological Closing` để tìm vùng văn bản.
- **Noise Filtering:** Tích hợp bộ lọc thông minh (`filter_outer_polygons`) giúp loại bỏ các khung hình lồng nhau và nhiễu nhỏ, chỉ giữ lại các vùng văn bản tiềm năng nhất.

### 3. Interactive Warp (Cắt tương tác)
- **One-Click Action:** Thay vì phải kéo thả 4 điểm thủ công, người dùng chỉ cần **Click chuột** vào vùng khung xanh (Candidate) trên màn hình.
- **Instant Processing:** Hệ thống tự động lấy tọa độ, gửi về Server và trả về ảnh đã được cắt và chỉnh phẳng (Deskew) ngay lập tức.

## 🛠️ Công nghệ sử dụng

- **Backend:** Python, FastAPI, OpenCV, NumPy.
- **Frontend:** ReactJS (Vite), Axios, HTML5 Canvas.
- **Computer Vision:** Canny Edge, Contour Approximation, Perspective Transform.

## ⚙️ Hướng dẫn cài đặt & Chạy

Yêu cầu: Máy đã cài [Python 3.8+](https://www.python.org/) và [Node.js](https://nodejs.org/).

### 1. Khởi chạy Backend (Server)
Mở terminal tại thư mục `backend`:

```bash
cd backend

# Tạo và kích hoạt môi trường ảo
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
# source venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy Server
uvicorn main:app --reload
```

Server sẽ chạy tại: http://127.0.0.1:8000

### 2. Khởi chạy Frontend (Client)
Mở terminal mới tại thư mục frontend:

```Bash

cd frontend

# Cài đặt node modules
npm install

# Chạy ứng dụng
npm run dev
```
Truy cập Web tại: http://localhost:5173

📂 Cấu trúc dự án

```
project1_deskew/
├── backend/
│   ├── main.py         # Logic chính: API, Canny Edge, Warp Perspective
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx     # Logic chính: UI, Sliders, Canvas interaction
│   │   ├── App.css     # Styles cho Layout chia cột và Canvas
│   │   └── main.jsx    # Entry point
│   └── package.json
└── README.md           # Tài liệu dự án
```