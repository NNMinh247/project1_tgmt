import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [edgeImageSrc, setEdgeImageSrc] = useState(null);
  const [resultSrc, setResultSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // States thanh trượt
  const [threshold1, setThreshold1] = useState(75);
  const [threshold2, setThreshold2] = useState(200);
  const [morphKernel, setMorphKernel] = useState(5);
  const [resizeWidth, setResizeWidth] = useState(650); // Mặc định to hơn chút cho nét

  const canvasRef = useRef(null);
  const [candidates, setCandidates] = useState([]); 

  // --- LOGIC GIỮ NGUYÊN ---
  const isPointInPolygon = (p, vs) => {
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setImageSrc(evt.target.result);
        setResultSrc(null);
        setEdgeImageSrc(null);
        setCandidates([]);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!imageSrc) return;
    detectDocuments();
  }, [imageSrc]); 

  const detectDocuments = async () => {
      setIsLoading(true);
      try {
          const res = await axios.post('http://127.0.0.1:8000/process', {
              image: imageSrc, 
              action: 'detect',
              threshold1: parseInt(threshold1),
              threshold2: parseInt(threshold2),
              morph_kernel: parseInt(morphKernel),
              resize_width: parseInt(resizeWidth)
          });
          
          if (res.data.candidates) setCandidates(res.data.candidates);
          if (res.data.edge_image) setEdgeImageSrc(res.data.edge_image);
      } catch (e) { console.error(e); } 
      finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (!imageSrc) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = imageSrc; 
    
    img.onload = () => {
        const maxWidth = 800; // Tăng kích thước Canvas hiển thị cho dễ chọn
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;

        candidates.forEach(poly => {
            const pts = poly.map(p => ({ x: p[0]*scaleX, y: p[1]*scaleY }));
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for(let i=1; i<4; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
            
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#2ecc71'; 
            ctx.setLineDash([5, 3]); 
            ctx.stroke();
            ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
            ctx.fill();
            ctx.setLineDash([]); 
        });
    };
  }, [imageSrc, candidates]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { 
        x: (e.clientX - rect.left) * scaleX, 
        y: (e.clientY - rect.top) * scaleY 
    };
  };

  const handleMouseDown = async (e) => {
      e.preventDefault();
      if (candidates.length === 0) return;
      const clickPos = getMousePos(e);
      const canvas = canvasRef.current;
      const getImgSize = (src) => new Promise(r => {const i=new Image(); i.onload=()=>r({w:i.width, h:i.height}); i.src=src});
      const size = await getImgSize(imageSrc);
      const scaleX = canvas.width / size.w;
      const scaleY = canvas.height / size.h;

      for (let poly of candidates) {
          const canvasPoly = poly.map(p => ({ x: p[0]*scaleX, y: p[1]*scaleY }));
          if (isPointInPolygon(clickPos, canvasPoly)) {
              processWarp(poly); 
              return; 
          }
      }
  };

  const processWarp = async (pointsToSend) => {
      setIsLoading(true);
      try {
          const res = await axios.post('http://127.0.0.1:8000/process', {
              image: imageSrc, points: pointsToSend, action: 'warp'
          });
          setResultSrc(res.data.processed_image);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
  };

  return (
    <div className="app-container">
      <header className="header">
          <h1 className="title">Smart Document Scanner</h1>
          <p className="subtitle">Project 2: Computer Vision Final</p>
      </header>

      {/* --- PHẦN ĐIỀU KHIỂN ĐÃ ĐƯỢC TÁCH --- */}
      <div className="control-panel">
          
          {/* 1. Khu vực Upload (Luôn hiển thị) */}
          <div className="upload-section">
             <label className="upload-label">
                Upload Image
                <input className="file-input" type="file" onChange={handleFileChange} accept="image/*" />
             </label>
          </div>

          {imageSrc && (
              <div className="control-grid">
                  {/* CỘT TRÁI: THANH CHỈNH SỬA */}
                  <div className="sliders-column">
                      <h3 className="column-title">Parameters Tuning</h3>
                      
                      <div className="slider-group">
                          <label>Threshold 1 (Min): <strong>{threshold1}</strong></label>
                          <input type="range" min="0" max="255" value={threshold1} 
                            onChange={(e) => setThreshold1(e.target.value)} onMouseUp={detectDocuments} />
                      </div>
                      
                      <div className="slider-group">
                          <label>Threshold 2 (Max): <strong>{threshold2}</strong></label>
                          <input type="range" min="0" max="255" value={threshold2} 
                            onChange={(e) => setThreshold2(e.target.value)} onMouseUp={detectDocuments} />
                      </div>

                      <div className="slider-group">
                          <label>Morph Kernel (Độ dày nét): <strong>{morphKernel}</strong></label>
                          <input type="range" min="1" max="21" step="2" value={morphKernel} 
                            onChange={(e) => setMorphKernel(e.target.value)} onMouseUp={detectDocuments} />
                      </div>

                      <div className="slider-group">
                          <label>Resize Width (Speed/Detail): <strong>{resizeWidth}</strong></label>
                          <input type="range" min="300" max="1000" step="50" value={resizeWidth} 
                            onChange={(e) => setResizeWidth(e.target.value)} onMouseUp={detectDocuments} />
                      </div>

                      <div className="status-message">
                          Found <span className="highlight-count">{candidates.length}</span> documents.
                      </div>
                  </div>

                  {/* CỘT PHẢI: PREVIEW TO ĐÙNG */}
                  <div className="preview-column">
                      <h3 className="column-title">Edge Detection Preview</h3>
                      <div className="edge-preview-box">
                          {edgeImageSrc ? (
                              <img src={edgeImageSrc} alt="Edge Debug" />
                          ) : (
                              <p>Loading preview...</p>
                          )}
                      </div>
                      <p className="hint-text">Adjust sliders until document edges are clear and connected.</p>
                  </div>
              </div>
          )}
      </div>

      {/* --- PHẦN WORKSPACE (GIỮ NGUYÊN LOGIC, CHỈNH LẠI CSS) --- */}
      <div className="workspace">
          {imageSrc && (
            <div className="card-box">
                <h3 className="card-title">1. Select Document (Click Green Box)</h3>
                <div className="canvas-wrapper">
                    <canvas 
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        className="canvas-interactive"
                    />
                </div>
            </div>
          )}

          {resultSrc && (
              <div className="card-box">
                  <h3 className="card-title">2. Scanned Result</h3>
                  <img src={resultSrc} className="result-img" alt="Result" />
                  <a href={resultSrc} download="scanned_doc.jpg" className="btn-download">Download JPG</a>
              </div>
          )}
      </div>
    </div>
  );
}

export default App;