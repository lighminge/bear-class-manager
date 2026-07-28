import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar as CalendarIcon, Loader2, Save, FileText } from 'lucide-react';

interface WeeklyEntry {
  weather: string;
  act: string;
  motor: string;
  ref: string;
  ane: string;
  com: string;
}

export default function WeeklySchedule() {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  
  const [entries, setEntries] = useState<Record<string, WeeklyEntry>>({});
  const [leaves, setLeaves] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>({ leadTeacher: '主教', coTeacher: '協同', academicYear: '114', semester: '上學期' });
  const [annualEvents, setAnnualEvents] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Generate week dates (Monday to Friday)
  const getWeekDays = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return Array.from({ length: 5 }).map((_, i) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      return current.toISOString().split('T')[0];
    });
  };

  const weekDays = getWeekDays(currentDate);

  // Determine current week index (1 to 21) based on AnnualEvents startDate
  let viewingWeek = 1;
  let currentTheme = '各班自訂';
  let currentEvents = '';
  const annualDoc = annualEvents[`${settings.academicYear}_${settings.semester}`];
  if (annualDoc && annualDoc.startDate) {
    const st = new Date(annualDoc.startDate);
    const curr = new Date(currentDate);
    const diffTime = curr.getTime() - st.getTime();
    viewingWeek = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    if (annualDoc.weeks && annualDoc.weeks[viewingWeek - 1]) {
      currentTheme = annualDoc.weeks[viewingWeek - 1].theme || currentTheme;
      currentEvents = annualDoc.weeks[viewingWeek - 1].events || '';
    }
  }

  // Find teachers on leave this week
  const teachersOnLeaveThisWeek: string[] = [];
  weekDays.forEach(dateStr => {
    if (leaves[dateStr]) {
      teachersOnLeaveThisWeek.push(`${dateStr.substring(5).replace('-', '/')} ${leaves[dateStr]}`);
    }
  });

  let displayLeadTeacher = settings.leadTeacher || '主教';
  let displayCoTeacher = settings.coTeacher || '協同';

  if (settings.teachersRotation && settings.teachersRotation.teacherA) {
    const rot = settings.teachersRotation;
    const isOdd = viewingWeek % 2 !== 0;
    const secondTeacher = rot.firstWeekLead === rot.teacherA ? rot.teacherB : rot.teacherA;
    if (isOdd) {
      displayLeadTeacher = rot.firstWeekLead;
      displayCoTeacher = secondTeacher;
    } else {
      displayLeadTeacher = secondTeacher;
      displayCoTeacher = rot.firstWeekLead;
    }
  }

  // Fetch all necessary data
  useEffect(() => {
    setLoading(true);
    const unsubEntries = onSnapshot(collection(db, 'bear_scheduleEntries'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setEntries(data);
      setLoading(false);
    });

    const unsubLeaves = onSnapshot(doc(db, 'bear_teacherLeaves', 'all'), (snap) => {
      if (snap.exists()) setLeaves(snap.data().records || {});
    });

    const unsubSettings = onSnapshot(doc(db, 'bear_settings', 'main'), (snap) => {
      if (snap.exists()) setSettings((prev: any) => ({ ...prev, ...snap.data() }));
    });

    const unsubAnnual = onSnapshot(collection(db, 'bear_annualEvents'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setAnnualEvents(data);
    });

    const unsubAtt = onSnapshot(collection(db, 'bear_attendance'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data().records || {}; });
      setAttendance(data);
    });

    return () => {
      unsubEntries();
      unsubLeaves();
      unsubSettings();
      unsubAnnual();
      unsubAtt();
    };
  }, []);

  // Fetch live weather when date changes (for empty weather fields)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=24.14&longitude=120.68&current_weather=true');
        const data = await res.json();
        if (data && data.current_weather) {
          const w = data.current_weather.weathercode <= 3 ? '晴朗' : data.current_weather.weathercode <= 48 ? '多雲' : '雨天';
          const weatherStr = w;
          
          const todayStr = new Date().toISOString().split('T')[0];
          if (weekDays.includes(todayStr)) {
            const entry = entries[`${todayStr}_0`] || {};
            if (!entry.weather) {
              handleFieldChange(todayStr, 'weather', weatherStr);
            }
          }
        }
      } catch (err) { }
    };
    fetchWeather();
    // eslint-disable-next-line
  }, [currentDate]);

  const handleFieldChange = (date: string, field: string, value: string) => {
    setEntries(prev => ({
      ...prev,
      [`${date}_0`]: {
        ...prev[`${date}_0`],
        [field]: value
      }
    }));
  };

  const saveEntry = async (date: string) => {
    setSaving(true);
    try {
      const data = entries[`${date}_0`] || {};
      await setDoc(doc(db, 'bear_scheduleEntries', `${date}_0`), data, { merge: true });
    } catch (error) {
      console.error(error);
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const navWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (dir * 7));
    setCurrentDate(d.toISOString().split('T')[0]);
  };

  const exportToWord = () => {
    let htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>每週教學日誌</title>
    <style>
      body { font-family: "Microsoft JhengHei", "標楷體", sans-serif; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th, td { border: 1px solid black; padding: 12px; text-align: left; vertical-align: top; }
      th { background-color: #f2f2f2; width: 120px; font-weight: bold; }
      h1 { text-align: center; color: #333; }
      h3 { text-align: center; color: #555; margin-bottom: 5px; }
      .att-summary { text-align: center; font-size: 14px; color: #333; margin-bottom: 15px; }
    </style></head><body>
    `;

    weekDays.forEach((dateStr, idx) => {
      const entry = entries[`${dateStr}_0`] || {};
      const dayAtt = attendance[dateStr] || {};
      let pCount = 0;
      let lCount = 0;
      Object.values(dayAtt).forEach((st: any) => {
        if (st.status === 'attend') pCount++;
        else if (st.status !== 'unexcused') lCount++;
      });
      
      const formatText = (text: string) => (text || '').replace(/\n/g, '<br>');
      const pageBreak = idx > 0 ? '<div style="page-break-before: always;"></div><br clear="all" style="page-break-before:always; mso-break-type:page-break" />' : '';

      htmlContent += `
        ${pageBreak}
        <div>
            <h1>小熊班 每日教學日誌</h1>
            <h3>日期：${dateStr} (星期${['一','二','三','四','五'][idx]}) &nbsp;&nbsp;&nbsp; 天氣：${entry.weather || '未填寫'}</h3>
            <h3>本週主題：${currentTheme}</h3>
            <div class="att-summary">出席：${pCount}人 &nbsp;|&nbsp; 請假：${lCount}人</div>
            <table>
                <tr><th>📌 教學活動</th><td>${formatText(entry.act)}</td></tr>
                <tr><th>💪 大肌肉運動</th><td>${formatText(entry.motor)}</td></tr>
                <tr><th>💭 教學省思</th><td>${formatText(entry.ref)}</td></tr>
                <tr><th>📝 軼事記錄</th><td>${formatText(entry.ane)}</td></tr>
                <tr><th>🤝 親師溝通</th><td>${formatText(entry.com)}</td></tr>
            </table>
        </div>
      `;
    });

    htmlContent += `</body></html>`;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `小熊班教學日誌_第${viewingWeek}週.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMiniMonthCalendar = () => {
    const current = new Date(currentDate);
    const y = current.getFullYear();
    const m = current.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    return (
      <div className="bg-black/30 p-2 rounded border border-white/20 text-xs w-48 shadow-inner">
        <div className="text-center font-bold text-yellow-300 mb-2">{m + 1}月</div>
        <div className="grid grid-cols-7 gap-1 text-center text-white/50 mb-1">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isWeekDay = weekDays.includes(dateStr);
            const teacherLeave = leaves[dateStr];
            let classes = "rounded-sm py-0.5 ";
            if (teacherLeave === displayLeadTeacher) classes += "bg-purple-600 font-bold border border-purple-300 text-[10px] leading-tight";
            else if (teacherLeave === displayCoTeacher) classes += "bg-blue-600 font-bold border border-blue-300 text-[10px] leading-tight";
            else if (isWeekDay) classes += "bg-yellow-500/30 font-bold outline outline-1 outline-yellow-400";
            else classes += "text-white/80";

            return (
              <div key={d} className={classes} title={teacherLeave ? `${teacherLeave}請假` : ''}>
                {teacherLeave ? teacherLeave[0] : d}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const dayNames = ['星期一', '星期二', '星期三', '星期四', '星期五'];

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in space-y-6">
      <div className="chalk-box flex flex-col md:flex-row gap-4 justify-between items-start">
        <div className="flex gap-4">
          <CalendarIcon className="w-8 h-8 text-yellow-300 shrink-0" />
          <div>
            <h2 className="text-2xl font-bold mb-2">每週排程行事曆 - 第 {viewingWeek} 週</h2>
            <div className="flex gap-2">
              <button onClick={() => navWeek(-1)} className="chalk-btn py-1 px-3 text-sm">上一週</button>
              <input 
                type="date" 
                value={currentDate} 
                onChange={(e) => setCurrentDate(e.target.value)} 
                className="chalk-input bg-white/10 px-2 rounded py-0"
              />
              <button onClick={() => navWeek(1)} className="chalk-btn py-1 px-3 text-sm">下一週</button>
            </div>
            <div className="mt-4 flex gap-4">
               {renderMiniMonthCalendar()}
               <div className="bg-black/20 border border-white/20 rounded p-3 text-sm flex flex-col justify-center gap-2 w-48">
                 <div><span className="text-yellow-200">主班老師：</span><span className="font-bold">{displayLeadTeacher}</span></div>
                 <div><span className="text-yellow-200">協同老師：</span><span className="font-bold">{displayCoTeacher}</span></div>
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full md:w-auto">
          <button onClick={exportToWord} className="chalk-btn bg-blue-600/70 hover:bg-blue-500 shadow-lg justify-center w-full">
            <FileText className="w-5 h-5" />
            匯出本週紀錄 (Word)
          </button>
          <div className="bg-white/10 rounded-xl p-4 border border-white/30 backdrop-blur shadow-lg text-sm text-left flex flex-col gap-2">
            <div>
              <div className="text-yellow-200 mb-1 font-bold">🎯 本週教學主題</div>
              <div className="text-lg font-bold tracking-wider">{currentTheme}</div>
            </div>
            {currentEvents && (
              <div>
                <div className="text-yellow-200 mb-1 font-bold mt-2">📌 本週重點事項</div>
                <div className="whitespace-pre-wrap">{currentEvents}</div>
              </div>
            )}
            {teachersOnLeaveThisWeek.length > 0 && (
              <div>
                <div className="text-red-300 mb-1 font-bold mt-2">⚠️ 本週請假資訊</div>
                <div className="text-red-200">
                  {teachersOnLeaveThisWeek.map((info, idx) => (
                    <div key={idx}>{info}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-white/50" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {weekDays.map((dateStr, idx) => {
            const entry = entries[`${dateStr}_0`] || {};
            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const dayAtt = attendance[dateStr] || {};
            let pCount = 0; let lCount = 0;
            Object.values(dayAtt).forEach((st: any) => {
              if (st.status === 'attend') pCount++;
              else if (st.status !== 'unexcused') lCount++;
            });

            return (
              <div key={dateStr} className={`chalk-box flex flex-col ${isToday ? 'border-4 border-yellow-400 bg-yellow-600/20' : ''}`}>
                <div className="text-center font-bold text-lg border-b border-white/20 pb-4 mb-4 flex flex-col items-center">
                  <div className="flex gap-2 items-center">
                    <div className={isToday ? 'text-yellow-300' : 'text-white'}>{dayNames[idx]}</div>
                    <div className={`text-xl ${isToday ? 'text-yellow-300' : 'text-white'}`}>{dateStr.substring(5).replace('-', '/')}</div>
                  </div>
                  <div className="text-sm bg-black/40 rounded-lg p-2 mt-3 font-bold text-yellow-300 border-2 border-white/20 shadow-inner w-full">
                     出勤: <span className="text-green-400">{pCount}</span> 人 | 請假: <span className="text-red-400">{lCount}</span> 人
                  </div>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                  <div>
                    <label className="text-xs text-yellow-200">🌤️ 天氣</label>
                    <input 
                      type="text" 
                      value={entry.weather || ''} 
                      onChange={e => handleFieldChange(dateStr, 'weather', e.target.value)} 
                      onBlur={() => saveEntry(dateStr)}
                      className="chalk-input w-full text-sm py-1 bg-black/20 rounded px-2 mt-1 border-b-0"
                      placeholder="如: 晴朗 28°C" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">📖 教學活動</label>
                    <textarea 
                      value={entry.act || ''} 
                      onChange={e => handleFieldChange(dateStr, 'act', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[80px] text-sm custom-scrollbar mt-1"
                      placeholder="教學活動..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">🏃 大肌肉活動</label>
                    <textarea 
                      value={entry.motor || ''} 
                      onChange={e => handleFieldChange(dateStr, 'motor', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">🧐 教學省思</label>
                    <textarea 
                      value={entry.ref || ''} 
                      onChange={e => handleFieldChange(dateStr, 'ref', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">📝 軼事記錄</label>
                    <textarea 
                      value={entry.ane || ''} 
                      onChange={e => handleFieldChange(dateStr, 'ane', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">💬 親師溝通事項</label>
                    <textarea 
                      value={entry.com || ''} 
                      onChange={e => handleFieldChange(dateStr, 'com', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar mt-1"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
