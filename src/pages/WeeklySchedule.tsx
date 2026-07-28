import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar as CalendarIcon, Loader2, Save } from 'lucide-react';

export default function WeeklySchedule() {
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    // 預設為當週一
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  
  const [entries, setEntries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 取得該週的五天 (星期一到星期五)
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

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'bear_scheduleEntries'), (snapshot) => {
      const data: Record<string, any> = {};
      snapshot.docs.forEach(d => {
        data[d.id] = d.data();
      });
      setEntries(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const dayNames = ['星期一', '星期二', '星期三', '星期四', '星期五'];

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="chalk-box flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <CalendarIcon className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">每週排程行事曆</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => navWeek(-1)} className="chalk-btn">上一週</button>
          <input 
            type="date" 
            value={currentDate} 
            onChange={(e) => setCurrentDate(e.target.value)} 
            className="chalk-input bg-white/10 px-2 rounded"
          />
          <button onClick={() => navWeek(1)} className="chalk-btn">下一週</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-white/50" /></div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {weekDays.map((dateStr, idx) => {
            const entry = entries[`${dateStr}_0`] || {};
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div key={dateStr} className={`chalk-box flex flex-col ${isToday ? 'border-4 border-yellow-400 bg-yellow-600/20' : ''}`}>
                <div className="text-center font-bold text-lg border-b border-white/20 pb-2 mb-2 flex justify-between items-center">
                  <div>
                    <div className={isToday ? 'text-yellow-300' : 'text-white'}>{dayNames[idx]}</div>
                    <div className="text-sm font-normal opacity-70">{dateStr}</div>
                  </div>
                  <button 
                    onClick={() => saveEntry(dateStr)} 
                    disabled={saving}
                    className="chalk-btn text-xs px-2 py-1 bg-yellow-600/50 hover:bg-yellow-500"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                  <div>
                    <label className="text-xs text-yellow-200">🌤️ 天氣</label>
                    <input 
                      type="text" 
                      value={entry.weather || ''} 
                      onChange={e => handleFieldChange(dateStr, 'weather', e.target.value)} 
                      onBlur={() => saveEntry(dateStr)}
                      className="chalk-input w-full text-sm py-1"
                      placeholder="如: 晴朗" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">📖 教學活動</label>
                    <textarea 
                      value={entry.act || ''} 
                      onChange={e => handleFieldChange(dateStr, 'act', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-1.5 text-white outline-none focus:bg-white/10 resize-none min-h-[80px] text-sm custom-scrollbar"
                      placeholder="教學活動..."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">🏃 大肌肉活動</label>
                    <textarea 
                      value={entry.motor || ''} 
                      onChange={e => handleFieldChange(dateStr, 'motor', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-1.5 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">🧐 教學省思</label>
                    <textarea 
                      value={entry.ref || ''} 
                      onChange={e => handleFieldChange(dateStr, 'ref', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-1.5 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">📝 軼事記錄</label>
                    <textarea 
                      value={entry.ane || ''} 
                      onChange={e => handleFieldChange(dateStr, 'ane', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-1.5 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-yellow-200">💬 親師溝通事項</label>
                    <textarea 
                      value={entry.com || ''} 
                      onChange={e => handleFieldChange(dateStr, 'com', e.target.value)}
                      onBlur={() => saveEntry(dateStr)}
                      className="w-full bg-black/20 rounded p-1.5 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] text-sm custom-scrollbar"
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
