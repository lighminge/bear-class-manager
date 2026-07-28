import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Save, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface WeekData {
  theme: string;
  events: string;
}

interface AnnualData {
  startDate: string;
  weeks: WeekData[];
}

export default function AnnualCalendar() {
  const [year, setYear] = useState('114');
  const [semester, setSemester] = useState('上學期');
  const [startDate, setStartDate] = useState('');
  const [weeks, setWeeks] = useState<WeekData[]>(Array(21).fill({ theme: '', events: '' }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Helper to calculate the monday of the first week based on year and semester
  const getDefaultStartDate = (y: string, s: string) => {
    const gregorianYear = parseInt(y) + 1911;
    const target = s === '上學期' ? new Date(gregorianYear, 7, 30) : new Date(gregorianYear + 1, 1, 11);
    const day = target.getDay();
    const diff = target.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(target.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const docId = `${year}_${semester}`;

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'bear_annualEvents', docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnualData;
        setStartDate(data.startDate || getDefaultStartDate(year, semester));
        const loadedWeeks = data.weeks || Array(21).fill({ theme: '', events: '' });
        // Ensure it has exactly 21 weeks
        while(loadedWeeks.length < 21) loadedWeeks.push({ theme: '', events: '' });
        setWeeks(loadedWeeks.slice(0, 21));
      } else {
        setStartDate(getDefaultStartDate(year, semester));
        setWeeks(Array(21).fill({ theme: '', events: '' }));
      }
      setHasChanges(false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [year, semester, docId]);

  const handleWeekChange = (index: number, field: keyof WeekData, value: string) => {
    const newWeeks = [...weeks];
    newWeeks[index] = { ...newWeeks[index], [field]: value };
    setWeeks(newWeeks);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'bear_annualEvents', docId), {
        startDate,
        weeks
      }, { merge: true });
      setHasChanges(false);
      alert('年度行事曆已儲存！');
    } catch (error) {
      console.error(error);
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  // Generate Date Range for a week
  const getWeekRange = (weekIndex: number) => {
    if (!startDate) return '';
    const start = new Date(startDate);
    start.setDate(start.getDate() + (weekIndex * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="chalk-box flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Calendar className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">學校年度行事曆</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <select value={year} onChange={(e) => setYear(e.target.value)} className="chalk-input text-black bg-white w-24 text-lg font-bold">
            {['112', '113', '114', '115', '116', '117'].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="chalk-input text-black bg-white w-32 text-lg font-bold">
            <option value="上學期">上學期</option>
            <option value="下學期">下學期</option>
          </select>
          <div className="flex items-center gap-2">
            <span>開學週:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => { setStartDate(e.target.value); setHasChanges(true); }} 
              className="chalk-input bg-white/10 px-2 rounded"
            />
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving || (!hasChanges && !saving)}
            className={`chalk-btn transition-colors ${hasChanges ? 'bg-yellow-600 hover:bg-yellow-500' : 'opacity-50 cursor-not-allowed'}`}
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
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/50 bg-black/20">
                <th className="p-3 w-16 text-center">週次</th>
                <th className="p-3 w-32 text-center">日期區間</th>
                <th className="p-3 w-1/3">教學主題</th>
                <th className="p-3">全園/班級行事曆</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, idx) => (
                <motion.tr 
                  key={idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-white/10 hover:bg-white/5"
                >
                  <td className="p-3 text-center font-bold text-yellow-300">W{idx + 1}</td>
                  <td className="p-3 text-center text-sm text-gray-300">{getWeekRange(idx)}</td>
                  <td className="p-2">
                    <textarea 
                      value={week.theme}
                      onChange={(e) => handleWeekChange(idx, 'theme', e.target.value)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] custom-scrollbar text-sm"
                      placeholder="主題名稱..."
                    />
                  </td>
                  <td className="p-2">
                    <textarea 
                      value={week.events}
                      onChange={(e) => handleWeekChange(idx, 'events', e.target.value)}
                      className="w-full bg-black/20 rounded p-2 text-white outline-none focus:bg-white/10 resize-none min-h-[60px] custom-scrollbar text-sm"
                      placeholder="活動與行事曆..."
                    />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
