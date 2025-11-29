import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [resultSrc, setResultSrc] = useState(null);
  const [mode, setMode] = useState('auto');
  const [angle, setAngle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const canvasRef = useRef(null);
  const [candidates, setCandidates] = useState([]); 
  const [selectedAutoPoints, setSelectedAutoPoints] = useState([]);
  const [manualPoints, setManualPoints] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(-1);

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
        setAngle(null);
        setCandidates([]);
        setSelectedAutoPoints([]);
        setManualPoints([]);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!imageSrc) return;
    if (mode === 'auto') {
        fetchCandidates();
    } else {
        if (manualPoints.length === 0) initManualPoints();
    }
  }, [mode, imageSrc]);

  const initManualPoints = () => {
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      setManualPoints([
          {x: w*0.2, y: h*0.2}, {x: w*0.8, y: h*0.2},
          {x: w*0.8, y: h*0.8}, {x: w*0.2, y: h*0.8}
      ]);
  };

  const fetchCandidates = async () => {
      setIsLoading(true);
      try {
          const res = await axios.post('http://127.0.0.1:8000/process', {
              image: imageSrc, action: 'detect'
          });
          setCandidates(res.data.candidates || []);
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
        const maxWidth = 600;
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        
        ctx.clearRect(0,0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        if (mode === 'auto') {
            candidates.forEach(poly => {
                ctx.beginPath();
                ctx.moveTo(poly[0][0]*scale, poly[0][1]*scale);
                for(let i=1; i<4; i++) ctx.lineTo(poly[i][0]*scale, poly[i][1]*scale);
                ctx.closePath();
                ctx.strokeStyle = '#3498db';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
            });

            if (selectedAutoPoints.length === 4) {
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(selectedAutoPoints[0].x, selectedAutoPoints[0].y);
                selectedAutoPoints.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.closePath();
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.fillStyle = 'rgba(46, 204, 113, 0.3)';
                ctx.fill();
            }
        }

        if (mode === 'manual' && manualPoints.length === 4) {
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(manualPoints[0].x, manualPoints[0].y);
            manualPoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 2;
            ctx.stroke();

            manualPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#e74c3c';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.stroke();
            });
        }
    };
  }, [imageSrc, mode, candidates, selectedAutoPoints, manualPoints]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
      e.preventDefault();
      const pos = getMousePos(e);

      if (mode === 'auto') {
          if (candidates.length === 0) return;
          handleClickAuto(pos);
      } else {
          manualPoints.forEach((p, index) => {
              if (Math.hypot(p.x - pos.x, p.y - pos.y) < 25) {
                  setIsDragging(true);
                  setDragIndex(index);
              }
          });
      }
  };

  const handleMouseMove = (e) => {
      e.preventDefault();
      if (mode === 'manual' && isDragging) {
          const pos = getMousePos(e);
          const x = Math.max(0, Math.min(canvasRef.current.width, pos.x));
          const y = Math.max(0, Math.min(canvasRef.current.height, pos.y));
          const newPts = [...manualPoints];
          newPts[dragIndex] = {x, y};
          setManualPoints(newPts);
      }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleClickAuto = async (clickPos) => {
      const getImgSize = (src) => new Promise(r => {const i=new Image(); i.onload=()=>r({w:i.width}); i.src=src});
      const size = await getImgSize(imageSrc);
      const scale = canvasRef.current.width / size.w;

      for (let poly of candidates) {
          const canvasPoly = poly.map(p => ({ x: p[0]*scale, y: p[1]*scale }));
          if (isPointInPolygon(clickPos, canvasPoly)) {
              setSelectedAutoPoints(canvasPoly);
              processWarp(poly); 
              return;
          }
      }
  };

  const handleManualProcess = async () => {
      if (manualPoints.length !== 4) return;
      const getImgSize = (src) => new Promise(r => {const i=new Image(); i.onload=()=>r({w:i.width, h:i.height}); i.src=src});
      const size = await getImgSize(imageSrc);
      const scaleX = size.w / canvasRef.current.width;
      const scaleY = size.h / canvasRef.current.height;
      const realPoints = manualPoints.map(p => [p.x * scaleX, p.y * scaleY]);
      processWarp(realPoints);
  };

  const processWarp = async (pointsToSend) => {
      setIsLoading(true);
      try {
          const res = await axios.post('http://127.0.0.1:8000/process', {
              image: imageSrc, points: pointsToSend, action: 'warp'
          });
          if (res.data.error) alert(res.data.error);
          else {
              setResultSrc(res.data.processed_image);
              setAngle(res.data.angle_info);
          }
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
  };

  return (
    <div className="app-container">
      <header className="header">
          <h1 className="title">Project 1</h1>
          <p className="subtitle">Canny Edge Detection & 3D Pose Estimation</p>
      </header>

      <div className="controls-card">
          <div className="file-input-wrapper">
            <input className="file-input" type="file" onChange={handleFileChange} accept="image/*" />
          </div>
          
          <div className="button-group">
              <button onClick={() => setMode('auto')} className={`btn btn-auto ${mode==='auto'?'active':''}`}>
                  Auto Detect
              </button>
              <button onClick={() => setMode('manual')} className={`btn btn-manual ${mode==='manual'?'active':''}`}>
                  Manual
              </button>
          </div>
          
          {mode === 'manual' && (
              <button onClick={handleManualProcess} disabled={isLoading} className="btn btn-process">
                  {isLoading ? "Processing..." : "EXECUTE"}
              </button>
          )}
      </div>

      <div className="workspace">
          <div className="card-box">
              <h3 className="card-title">Input ({mode.toUpperCase()})</h3>
              <div className="canvas-wrapper">
                <canvas 
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className={mode === 'auto' ? 'canvas-mode-auto' : 'canvas-mode-manual'}
                />
              </div>
              <p className="instruction-text">
                  {mode === 'auto' 
                      ? `Found ${candidates.length} objects. Click to warp.` 
                      : 'Drag points to corners.'}
              </p>
          </div>

          {resultSrc && (
              <div className="card-box">
                  <h3 className="card-title">Result</h3>
                  <img src={resultSrc} className="result-img" alt="Result" />
                  
                  {angle && (
                    <div className="angle-container">
                        <div className="angle-header">3D Pose</div>
                        <div className="badge badge-roll">
                            <span>Roll</span> <strong>{angle.roll_z}°</strong>
                        </div>
                        <div className="badge badge-pitch">
                            <span>Pitch</span> <strong>{angle.pitch_x}°</strong>
                        </div>
                        <div className="badge badge-yaw">
                            <span>Yaw</span> <strong>{angle.yaw_y}°</strong>
                        </div>
                    </div>
                  )}
              </div>
          )}
      </div>
    </div>
  );
}

export default App;