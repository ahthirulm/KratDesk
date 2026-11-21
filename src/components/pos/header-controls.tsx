import {useEffect,useState} from 'react';
import {Link} from '@tanstack/react-router';
import {Bell,Sun,Moon,HandCoins,CalendarDays,CheckCircle2,Calculator,Wrench} from 'lucide-react';
import {FloatingCalculator} from './floating-calculator';
import {Button} from '@/components/ui/button';
import {Popover,PopoverContent,PopoverTrigger} from '@/components/ui/popover';

export function HeaderControls({loans,cheques,reminders=0,jobs=0}:{loans:number;cheques:number;reminders?:number;jobs?:number}) {
  const [dark,setDark]=useState(false);
  const [open,setOpen]=useState(false);
  const [calc,setCalc]=useState(false);
  useEffect(()=>{
    let saved:string|null=null;
    try {saved=localStorage.getItem('jewellery-pos-theme')} catch {}
    const enabled=saved==='dark';
    setDark(enabled);
    document.documentElement.classList.toggle('dark',enabled);
  },[]);
  function toggleTheme(){
    const enabled=!dark;
    setDark(enabled);
    document.documentElement.classList.toggle('dark',enabled);
    try {localStorage.setItem('jewellery-pos-theme',enabled?'dark':'light')} catch {}
  }
  const count=loans+cheques+reminders+jobs;
  return <div className="header-controls">
    <Button variant="ghost" size="icon" title="Calculator" aria-label="Calculator" aria-pressed={calc} onClick={()=>setCalc(v=>!v)}><Calculator size={19}/></Button>
    {calc&&<FloatingCalculator onClose={()=>setCalc(false)}/>}
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" className="notification-trigger" title="Notifications" aria-label={`Notifications${count?` (${count})`:''}`}><Bell size={19}/>{count>0&&<span className="notification-count">{count>99?'99+':count}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="notification-panel">
        <div className="notification-heading"><h2>Notifications</h2><span>{count} due</span></div>
        {loans>0&&<Button asChild variant="ghost" className="notification-row" onClick={()=>setOpen(false)}><Link to="/loans"><HandCoins/><span><b>{loans} {loans===1?'loan needs':'loans need'} collection</b><small>Review due repayments</small></span></Link></Button>}
        {jobs>0&&<Button asChild variant="ghost" className="notification-row" onClick={()=>setOpen(false)}><Link to="/repairs"><Wrench/><span><b>{jobs} {jobs===1?'job is':'jobs are'} overdue</b><small>Past the estimated delivery date</small></span></Link></Button>}{reminders>0&&<Button asChild variant="ghost" className="notification-row" onClick={()=>setOpen(false)}><Link to="/cheques"><CalendarDays/><span><b>{reminders} {reminders===1?'reminder is':'reminders are'} due</b><small>Open reminders</small></span></Link></Button>}{cheques>0&&<Button asChild variant="ghost" className="notification-row" onClick={()=>setOpen(false)}><Link to="/cheques"><CalendarDays/><span><b>{cheques} {cheques===1?'cheque is':'cheques are'} due for deposit</b><small>Review deposit reminders</small></span></Link></Button>}
        {count===0&&<div className="notification-empty"><CheckCircle2/><span>No due reminders</span></div>}
      </PopoverContent>
    </Popover>
    <Button variant="ghost" size="icon" title={dark?'Switch to light theme':'Switch to dark theme'} aria-label={dark?'Switch to light theme':'Switch to dark theme'} onClick={toggleTheme}>{dark?<Sun size={19}/>:<Moon size={19}/>}</Button>
  </div>;
}