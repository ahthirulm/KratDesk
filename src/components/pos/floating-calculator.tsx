import {useEffect,useRef,useState} from 'react';
import {Minus,X,History,Trash2,Calculator,Maximize2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {evaluate,formatResult} from '@/lib/calculator';

type Entry={expr:string;result:string};
const KEY='karatdesk-calc-history';
const keys=['C','(',')','÷','7','8','9','×','4','5','6','-','1','2','3','+','%','0','.','='];

export function FloatingCalculator({onClose}:{onClose:()=>void}){
  const [expr,setExpr]=useState('');
  const [error,setError]=useState('');
  const [history,setHistory]=useState<Entry[]>([]);
  const [showHistory,setShowHistory]=useState(false);
  const [min,setMin]=useState(false);
  const [pos,setPos]=useState({x:0,y:0});
  const drag=useRef<{dx:number;dy:number}|null>(null);
  const box=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    try{setHistory(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{}
    setPos({x:Math.max(8,window.innerWidth-320),y:72});
  },[]);
  function saveHistory(h:Entry[]){setHistory(h);try{localStorage.setItem(KEY,JSON.stringify(h))}catch{}}

  function press(k:string){
    setError('');
    if(k==='C')return setExpr('');
    if(k==='⌫')return setExpr(e=>e.slice(0,-1));
    if(k==='='){
      try{const r=formatResult(evaluate(expr));saveHistory([{expr,result:r},...history].slice(0,50));setExpr(r.replace(/,/g,''))}
      catch(e){setError(e instanceof Error&&e.message.includes('0')?e.message:'Invalid calculation')}
      return;
    }
    setExpr(e=>(e+k).slice(0,80));
  }
  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      if(min)return;
      const t=e.target as HTMLElement;if(t&&t!==box.current&&!box.current?.contains(t))return;
      const map:Record<string,string>={'*':'×','/':'÷',Enter:'=',Backspace:'⌫',Escape:'C'};
      const k=map[e.key]??e.key;
      if(/^[0-9.+\-%()]$/.test(k)||['×','÷','=','⌫','C'].includes(k)){e.preventDefault();press(k)}
    }
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });

  function start(e:React.PointerEvent){
    if((e.target as HTMLElement).closest('button'))return;
    drag.current={dx:e.clientX-pos.x,dy:e.clientY-pos.y};
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e:React.PointerEvent){
    if(!drag.current)return;
    const w=box.current?.offsetWidth||300;
    setPos({x:Math.min(Math.max(0,e.clientX-drag.current.dx),window.innerWidth-w),y:Math.min(Math.max(0,e.clientY-drag.current.dy),window.innerHeight-48)});
  }
  const end=()=>{drag.current=null};

  return <div ref={box} tabIndex={-1} className={`floating-calc ${min?'is-min':''}`} style={{left:pos.x,top:pos.y}} role="dialog" aria-label="Calculator">
    <div className="floating-calc-bar" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <span><Calculator size={15}/>Calculator</span>
      <div>
        {!min&&<Button variant="ghost" size="icon" title="History" aria-label="History" className={showHistory?'active':''} onClick={()=>setShowHistory(v=>!v)}><History size={15}/></Button>}
        <Button variant="ghost" size="icon" title={min?'Restore':'Minimise'} aria-label={min?'Restore':'Minimise'} onClick={()=>setMin(v=>!v)}>{min?<Maximize2 size={14}/>:<Minus size={15}/>}</Button>
        <Button variant="ghost" size="icon" title="Close" aria-label="Close calculator" onClick={onClose}><X size={15}/></Button>
      </div>
    </div>
    {!min&&(showHistory?<div className="floating-calc-history">
      {history.length===0?<p className="floating-calc-empty">No calculations yet</p>:history.map((h,i)=><button key={i} type="button" onClick={()=>{setExpr(h.result.replace(/,/g,''));setShowHistory(false)}}><small>{h.expr} =</small><b>{h.result}</b></button>)}
      {history.length>0&&<Button variant="ghost" size="sm" onClick={()=>saveHistory([])}><Trash2 size={14}/>Clear history</Button>}
    </div>:<>
      <div className="floating-calc-display"><small>{history[0]?`${history[0].expr} = ${history[0].result}`:'\u00a0'}</small><output>{error||expr||'0'}</output></div>
      <div className="floating-calc-keys">
        {keys.map(k=><button type="button" key={k} className={k==='='?'eq':/[÷×\-+%()C]/.test(k)?'op':''} onClick={()=>press(k)}>{k}</button>)}
        <button type="button" className="op back" onClick={()=>press('⌫')} aria-label="Backspace">⌫</button>
      </div>
    </>)}
  </div>;
}
