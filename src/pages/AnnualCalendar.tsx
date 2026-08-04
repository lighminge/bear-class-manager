import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Save, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface WeekData {
  theme: string;
  events: string;
  objectives?: string;
  days: string[]; // Legacy, kept for backwards compatibility but not rendered
}

interface AnnualData {
  startDate: string;
  weeks: WeekData[];
}

// Mini Calendar Component for a specific week
function MiniCalendar({ weekStartDate, onDateClick }: { weekStartDate: Date, onDateClick: (dateStr: string) => void }) {
  const month = weekStartDate.getMonth();
  const year = weekStartDate.getFullYear();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun, 1 is Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const emptyCells = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  // Create an array of the 7 dates in this week
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d.getDate();
  });
  // Check if the week actually spans two months, we just highlight the dates that match this month
  const weekMonths = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStartDate);
    d.setDate(d.getDate() + i);
    return d.getMonth();
  });

  return (
    <div className="bg-black/40 p-3 rounded-xl border border-white/20 text-sm w-44 shrink-0 shadow-inner">
      <div className="text-center font-bold text-yellow-300 mb-2 text-base">{month + 1}月</div>
      <div className="grid grid-cols-7 gap-1 text-center text-white/50 mb-1 font-bold">
        {['一', '二', '三', '四', '五', '六', '日'].map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: emptyCells }).map((_, i) => <div key={`empty-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const isHighlighted = weekDates.includes(d) && weekMonths[weekDates.indexOf(d)] === month;
          
          const handleCellClick = () => {
            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(d).padStart(2, '0');
            onDateClick(`${mStr}/${dStr}`);
          };

          return (
            <div 
              key={d} 
              onClick={handleCellClick}
              className={`rounded py-1 cursor-pointer transition-transform hover:scale-110 ${isHighlighted ? 'bg-yellow-500 text-black font-bold outline outline-2 outline-white/50 hover:bg-yellow-400 shadow' : 'text-white/80 hover:bg-white/20'}`}
              title={`新增 ${month + 1}/${d} 重點活動`}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnnualCalendar() {
  const [globalYear, setGlobalYear] = useState('114');
  const [semester, setSemester] = useState('上學期');
  const [startDate, setStartDate] = useState('');
  const [weeks, setWeeks] = useState<WeekData[]>(Array(21).fill({ theme: '', events: '', objectives: '', days: Array(7).fill('') }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const [showConfirm, setShowConfirm] = useState(false);

  // Day event input modal
  const [eventInputModal, setEventInputModal] = useState<{ weekIdx: number, dateStr: string, groupMonth: number } | null>(null);
  const [eventInputValue, setEventInputValue] = useState('');

  const getDefaultStartDate = (y: string, s: string) => {
    const gregorianYear = parseInt(y) + 1911;
    const target = s === '上學期' ? new Date(gregorianYear, 7, 30) : new Date(gregorianYear + 1, 1, 11);
    const day = target.getDay();
    const diff = day === 0 ? 1 : -(day - 1);
    const monday = new Date(target);
    monday.setDate(target.getDate() + diff);
    return monday.toISOString().split('T')[0];
  };

  const docId = `${globalYear}_${semester}`;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'bear_settings', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.academicYear) setGlobalYear(data.academicYear);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!globalYear) return;
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'bear_annualEvents', docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnualData;
        setStartDate(data.startDate || getDefaultStartDate(globalYear, semester));
        const loadedWeeks = data.weeks || [];
        const fullWeeks = Array.from({ length: 21 }).map((_, i) => {
          const w = loadedWeeks[i] || {};
          return {
            theme: w.theme || '',
            events: w.events || '',
            objectives: w.objectives || '',
            days: Array.isArray(w.days) && w.days.length === 7 ? w.days : Array(7).fill('')
          };
        });
        setWeeks(fullWeeks);
      } else {
        setStartDate(getDefaultStartDate(globalYear, semester));
        setWeeks(Array.from({ length: 21 }).map(() => ({ theme: '', events: '', objectives: '', days: Array(7).fill('') })));
      }
      setHasChanges(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [globalYear, semester, docId]);

  const handleWeekChange = (index: number, field: keyof WeekData, value: string) => {
    const newWeeks = [...weeks];
    newWeeks[index] = { ...newWeeks[index], [field]: value };
    setWeeks(newWeeks);
    setHasChanges(true);
  };

  const handleMonthEventsChange = (group: { month: number, weeks: { week: WeekData, idx: number }[] }, value: string) => {
    const newWeeks = [...weeks];
    group.weeks.forEach(item => {
      newWeeks[item.idx] = { ...newWeeks[item.idx], events: value };
    });
    setWeeks(newWeeks);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      await setDoc(doc(db, 'bear_annualEvents', docId), {
        startDate,
        weeks
      }, { merge: true });
      setHasChanges(false);
    } catch (error) {
      console.error(error);
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const getWeekStartDate = (weekIndex: number) => {
    const start = new Date(startDate);
    start.setDate(start.getDate() + (weekIndex * 7));
    return start;
  };

  // Grouping logic
  const groupedWeeks: { month: number, weeks: { week: WeekData, idx: number }[] }[] = [];
  let currentMonthGroup: any = null;

  weeks.forEach((week, idx) => {
    const d = getWeekStartDate(idx);
    const m = d.getMonth() + 1; // 1-12
    if (!currentMonthGroup || currentMonthGroup.month !== m) {
      currentMonthGroup = { month: m, weeks: [] };
      groupedWeeks.push(currentMonthGroup);
    }
    currentMonthGroup.weeks.push({ week, idx });
  });

  const saveEventContent = () => {
    if (!eventInputModal) return;
    if (!eventInputValue.trim()) {
      setEventInputModal(null);
      setEventInputValue('');
      return;
    }

    const { weekIdx, dateStr, groupMonth } = eventInputModal;
    const currentEvents = weeks[weekIdx].events;
    
    // Append the new event format: "MM/DD: event"
    const newEventLine = `${dateStr}: ${eventInputValue}`;
    const newEvents = currentEvents ? `${currentEvents}\n${newEventLine}` : newEventLine;
    
    const group = groupedWeeks.find(g => g.month === groupMonth);
    if (group) {
      handleMonthEventsChange(group, newEvents);
    }
    
    setEventInputModal(null);
    setEventInputValue('');
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in space-y-6">
      <ConfirmModal 
        isOpen={showConfirm}
        type="confirm"
        title="儲存變更"
        message={`確定要儲存 ${globalYear}學年度 ${semester} 的年度行事曆嗎？`}
        onConfirm={handleSave}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Event Editor Modal */}
      <AnimatePresence>
        {eventInputModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEventInputModal(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="chalk-box relative z-10 max-w-md w-full bg-[#2b5b3f] shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-3">
                <h3 className="text-xl font-bold text-yellow-300">
                  新增 {eventInputModal.dateStr} 重點活動
                </h3>
                <button onClick={() => setEventInputModal(null)} className="text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <textarea 
                value={eventInputValue} 
                onChange={(e) => setEventInputValue(e.target.value)} 
                className="chalk-input w-full min-h-[120px] resize-none bg-white text-black font-bold p-3 rounded mb-4" 
                placeholder="請輸入活動內容..." 
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => setEventInputModal(null)} className="chalk-btn bg-black/20 text-white/80 hover:bg-black/40">取消</button>
                <button onClick={saveEventContent} className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold px-6">確定</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="chalk-box flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">學校年度行事曆</h2>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          <div className="chalk-input text-black bg-yellow-300 px-4 py-2 rounded font-bold text-lg">
            {globalYear}學年
          </div>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="chalk-input text-black bg-white w-32 text-lg font-bold">
            <option value="上學期">上學期</option>
            <option value="下學期">下學期</option>
          </select>
          <div className="flex items-center gap-2">
            <span>第一週開始日期:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setHasChanges(true); }} 
              className="chalk-input bg-white/10 px-2 rounded"
            />
          </div>
          <button 
            onClick={() => setShowConfirm(true)} 
            disabled={saving || (!hasChanges && !saving)}
            className={`chalk-btn transition-colors ${hasChanges ? 'bg-yellow-600 hover:bg-yellow-500 shadow-lg shadow-yellow-500/20 font-bold' : 'opacity-50 cursor-not-allowed'}`}
          >
            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
            儲存變更
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-white/50" /></div>
      ) : (
        <div className="chalk-box overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-white/50 bg-black/20">
                <th className="p-3 w-16 text-center text-lg">月份</th>
                <th className="p-3 w-20 text-center text-lg">週次</th>
                <th className="p-3 w-[220px] text-center text-lg">月曆</th>
                <th className="p-3 text-lg">本月重點活動</th>
                <th className="p-3 w-[250px] text-lg">教學主題</th>
                <th className="p-3 w-[250px] text-lg">課程目標</th>
              </tr>
            </thead>
            <tbody>
              {groupedWeeks.map((group) => (
                <React.Fragment key={`group-${group.month}`}>
                  {group.weeks.map((item, wIdxInGroup) => {
                    const { week, idx } = item;
                    const isFirstInGroup = wIdxInGroup === 0;
                    return (
                      <motion.tr 
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-white/10 hover:bg-white/5 group"
                      >
                        {isFirstInGroup && (
                          <td rowSpan={group.weeks.length} className="p-3 text-center border-r border-white/10 font-black text-2xl text-yellow-500 bg-black/40 shadow-inner">
                            {group.month}月
                          </td>
                        )}
                        <td className="p-3 text-center font-bold text-yellow-300 text-lg">W{idx + 1}</td>
                        <td className="p-3 flex justify-center">
                          {startDate && <MiniCalendar weekStartDate={getWeekStartDate(idx)} onDateClick={(dateStr) => setEventInputModal({ weekIdx: idx, dateStr, groupMonth: group.month })} />}
                        </td>
                        {isFirstInGroup && (
                          <td rowSpan={group.weeks.length} className="p-3 border-r border-white/10">
                            <textarea 
                              value={week.events}
                              onChange={(e) => handleMonthEventsChange(group, e.target.value)}
                              className="w-full h-full bg-black/20 rounded p-3 text-white outline-none focus:bg-white/10 resize-none min-h-[160px] custom-scrollbar text-base font-bold shadow-inner"
                              placeholder="這裡輸入的內容會同步至每週排程行事曆的「本週重點活動」..."
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <textarea 
                            value={week.theme}
                            onChange={(e) => handleWeekChange(idx, 'theme', e.target.value)}
                            className="w-full bg-black/20 rounded p-3 text-yellow-100 outline-none focus:bg-white/10 resize-none min-h-[160px] custom-scrollbar text-base font-bold shadow-inner"
                            placeholder="主題名稱..."
                          />
                        </td>
                        <td className="p-3">
                          <textarea 
                            value={week.objectives || ''}
                            onChange={(e) => handleWeekChange(idx, 'objectives', e.target.value)}
                            className="w-full bg-black/20 rounded p-3 text-blue-100 outline-none focus:bg-white/10 resize-none min-h-[160px] custom-scrollbar text-base font-bold shadow-inner"
                            placeholder="課程目標..."
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
