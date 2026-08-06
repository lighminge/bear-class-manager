import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Save, Loader2, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface WeekData {
  theme: string;
  events: string;
  objectives?: string;
  days: string[]; // Legacy
}

interface AnnualData {
  startDate: string;
  weeks: WeekData[];
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

  // Unified Modal for Add / Edit
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    group: any;
    blockIndex?: number;
    text: string;
    hasDate: boolean;
    dateY: string;
    dateM: string;
    dateD: string;
  } | null>(null);

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
    if (!startDate) return;
    const d = getWeekStartDate(idx);
    const m = d.getMonth() + 1; // 1-12
    if (!currentMonthGroup || currentMonthGroup.month !== m) {
      currentMonthGroup = { month: m, weeks: [] };
      groupedWeeks.push(currentMonthGroup);
    }
    currentMonthGroup.weeks.push({ week, idx });
  });

  const getBlocks = (rawText: string) => {
    if (!rawText) return [];
    const hasDoubleNewline = /(?:\r?\n){2,}/.test(rawText);
    const blocks = hasDoubleNewline 
      ? rawText.split(/(?:\r?\n){2,}/) 
      : rawText.split('\n');
    return blocks.filter(b => b.trim() !== '');
  };

  const saveModalContent = () => {
    if (!actionModal) return;
    const { isEdit, group, blockIndex, text, hasDate, dateY, dateM, dateD } = actionModal;
    
    let finalContent = text.trim();
    if (!isEdit && hasDate && finalContent) {
      finalContent = `${dateY}/${dateM}/${dateD}: ${finalContent}`;
    }

    const currentEvents = group.weeks[0].week.events;
    const blocks = getBlocks(currentEvents);

    if (isEdit && blockIndex !== undefined) {
      if (finalContent === '') {
        blocks.splice(blockIndex, 1);
      } else {
        blocks[blockIndex] = finalContent;
      }
    } else {
      if (finalContent !== '') {
        blocks.push(finalContent);
      }
    }

    handleMonthEventsChange(group, blocks.join('\n\n'));
    setActionModal(null);
  };

  const deleteModalContent = () => {
    if (!actionModal || !actionModal.isEdit || actionModal.blockIndex === undefined) return;
    const { group, blockIndex } = actionModal;
    const blocks = getBlocks(group.weeks[0].week.events);
    blocks.splice(blockIndex, 1);
    handleMonthEventsChange(group, blocks.join('\n\n'));
    setActionModal(null);
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

      {/* Unified Action Modal */}
      <AnimatePresence>
        {actionModal?.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActionModal(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="chalk-box relative z-10 max-w-md w-full bg-[#2b5b3f] shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-3">
                <h3 className="text-xl font-bold text-yellow-300">
                  {actionModal.isEdit ? '修改活動內容' : '新增活動內容'}
                </h3>
                <button onClick={() => setActionModal(null)} className="text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              {!actionModal.isEdit && (
                <div className="mb-4 bg-black/20 p-3 rounded-lg border border-white/10">
                  <label className="flex items-center gap-2 text-white font-bold cursor-pointer mb-2">
                    <input 
                      type="checkbox" 
                      checked={actionModal.hasDate} 
                      onChange={(e) => setActionModal({...actionModal, hasDate: e.target.checked})}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    加入日期
                  </label>
                  
                  {actionModal.hasDate && (
                    <div className="flex items-center gap-2 mt-2">
                      <select 
                        value={actionModal.dateY}
                        onChange={(e) => setActionModal({...actionModal, dateY: e.target.value})}
                        className="bg-white text-black font-bold px-2 py-1 rounded outline-none w-20 text-center"
                      >
                        <option value={globalYear}>{globalYear}</option>
                        <option value={String(parseInt(globalYear) + 1)}>{parseInt(globalYear) + 1}</option>
                      </select>
                      <span className="text-white/80 font-bold">年</span>
                      
                      <select 
                        value={actionModal.dateM}
                        onChange={(e) => setActionModal({...actionModal, dateM: e.target.value})}
                        className="bg-white text-black font-bold px-2 py-1 rounded outline-none w-16 text-center"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-white/80 font-bold">月</span>

                      <select 
                        value={actionModal.dateD}
                        onChange={(e) => setActionModal({...actionModal, dateD: e.target.value})}
                        className="bg-white text-black font-bold px-2 py-1 rounded outline-none w-16 text-center"
                      >
                        {Array.from({ length: 31 }).map((_, i) => (
                          <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-white/80 font-bold">日</span>
                    </div>
                  )}
                </div>
              )}

              <textarea 
                value={actionModal.text} 
                onChange={(e) => setActionModal({...actionModal, text: e.target.value})} 
                className="chalk-input w-full min-h-[120px] resize-none bg-white text-black font-bold p-3 rounded mb-4" 
                placeholder="請輸入活動內容 (可換行輸入多行內容)..." 
                autoFocus
              />
              <div className="flex justify-between gap-3">
                {actionModal.isEdit ? (
                  <button onClick={deleteModalContent} className="chalk-btn bg-red-600/80 text-white hover:bg-red-500 font-bold px-6">刪除活動</button>
                ) : (
                  <div /> /* Empty div for spacing */
                )}
                <div className="flex gap-3">
                  <button onClick={() => setActionModal(null)} className="chalk-btn bg-black/20 text-white/80 hover:bg-black/40">取消</button>
                  <button onClick={saveModalContent} className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold px-6">儲存</button>
                </div>
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
        <div className="chalk-box overflow-x-auto bg-[#e8eed2] p-6 text-black" style={{ backgroundImage: 'url(https://www.transparenttextures.com/patterns/rice-paper-2.png)' }}>
          <table className="w-full text-left border-collapse min-w-[1200px] border-2 border-black/80 bg-white/80 backdrop-blur-sm shadow-xl">
            <thead>
              <tr className="border-b-2 border-black/80 bg-stone-100">
                <th rowSpan={2} className="p-2 w-10 text-center text-lg border-r-2 border-black/80 font-bold text-stone-800">月<br/>份</th>
                <th rowSpan={2} className="p-2 w-10 text-center text-lg border-r-2 border-black/80 font-bold text-stone-800 leading-tight">週<br/>次</th>
                <th colSpan={7} className="p-2 text-center text-lg border-r-2 border-black/80 tracking-[2em] ml-[1em] font-bold text-stone-800">日 期</th>
                <th rowSpan={2} className="p-3 text-center text-lg border-r-2 border-black/80 font-bold text-stone-800 w-[280px]">行事曆</th>
                <th rowSpan={2} className="p-3 text-center text-lg border-r-2 border-black/80 font-bold text-stone-800 w-[220px]">主題</th>
                <th rowSpan={2} className="p-3 text-center text-lg font-bold text-stone-800 w-[220px]">課程目標</th>
              </tr>
              <tr className="border-b-2 border-black/80 bg-stone-50">
                {['一', '二', '三', '四', '五', '六', '日'].map((day, i) => (
                  <th key={day} className={`p-1 w-8 text-center text-sm border-r border-black/30 font-bold ${i >= 5 ? 'text-red-600' : 'text-stone-700'}`}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedWeeks.map((group) => (
                <React.Fragment key={`group-${group.month}`}>
                  {group.weeks.map((item, wIdxInGroup) => {
                    const { week, idx } = item;
                    const isFirstInGroup = wIdxInGroup === 0;
                    
                    const weekDates = Array.from({ length: 7 }).map((_, i) => {
                      const d = getWeekStartDate(idx);
                      d.setDate(d.getDate() + i);
                      return d;
                    });

                    return (
                      <motion.tr 
                        key={idx}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className="border-b border-black/40 hover:bg-stone-100/50 group transition-colors"
                      >
                        {isFirstInGroup && (
                          <td rowSpan={group.weeks.length} className="p-2 text-center border-r-2 border-black/80 bg-yellow-100/80 align-top pt-6">
                            <div className="font-black text-2xl text-stone-800 flex flex-col items-center justify-center gap-1">
                              <span>{group.month}</span>
                              <span className="text-xl">月</span>
                            </div>
                          </td>
                        )}
                        
                        <td className="p-2 text-center border-r-2 border-black/80 align-top pt-4">
                          <div className="inline-block border-2 border-stone-800 px-1.5 py-0.5 text-sm font-bold text-stone-800 bg-white shadow-sm">
                            {idx + 1}
                          </div>
                        </td>

                        {weekDates.map((dateObj, i) => {
                          const isWeekend = i >= 5;
                          const bgClass = isWeekend ? 'bg-orange-50' : 'bg-teal-50';
                          const textClass = isWeekend ? 'text-red-600' : 'text-stone-700';
                          
                          return (
                            <td 
                              key={i}
                              className={`p-1 text-center font-bold border-r border-black/30 align-top pt-4 ${bgClass} ${textClass} hover:bg-yellow-200 cursor-pointer transition-colors`}
                              onClick={() => {
                                 const yStr = String(dateObj.getFullYear() - 1911);
                                 const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
                                 const dStr = String(dateObj.getDate()).padStart(2, '0');
                                 setActionModal({ 
                                   isOpen: true, 
                                   isEdit: false, 
                                   group: group, 
                                   text: '', 
                                   hasDate: true, 
                                   dateY: yStr, 
                                   dateM: mStr, 
                                   dateD: dStr 
                                 });
                              }}
                              title={`點擊新增 ${dateObj.getMonth() + 1}/${dateObj.getDate()} 的活動`}
                            >
                              {dateObj.getDate()}
                            </td>
                          );
                        })}

                        {isFirstInGroup && (
                          <td rowSpan={group.weeks.length} className="p-2 border-r-2 border-black/80 bg-white/50 align-top h-full">
                            <div className="flex flex-col h-full min-h-[120px] gap-2">
                              <div className="flex-1 flex flex-col gap-2 pt-1">
                                {getBlocks(week.events).map((blockText, blockIndex) => {
                                  return (
                                    <div 
                                      key={blockIndex} 
                                      onClick={() => setActionModal({
                                        isOpen: true,
                                        isEdit: true,
                                        group: group,
                                        blockIndex: blockIndex,
                                        text: blockText,
                                        hasDate: false,
                                        dateY: globalYear,
                                        dateM: '01',
                                        dateD: '01'
                                      })}
                                      className="bg-yellow-200/80 hover:bg-yellow-300 border border-yellow-400/80 text-stone-800 px-2.5 py-2 rounded shadow-sm text-[15px] font-bold cursor-pointer transition-transform hover:-translate-y-0.5 whitespace-pre-wrap leading-relaxed"
                                      title="點擊修改或刪除活動"
                                    >
                                      {blockText}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-auto pt-2 flex justify-center">
                                <button 
                                  onClick={() => setActionModal({
                                    isOpen: true,
                                    isEdit: false,
                                    group: group,
                                    text: '',
                                    hasDate: false,
                                    dateY: globalYear,
                                    dateM: String(group.month).padStart(2, '0'),
                                    dateD: '01'
                                  })}
                                  className="chalk-btn bg-stone-700 text-white hover:bg-stone-600 font-bold px-4 py-1.5 flex items-center gap-1 text-sm shadow-md"
                                >
                                  <Plus className="w-4 h-4" />
                                  新增活動
                                </button>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="p-2 border-r-2 border-black/80 bg-white/50 align-top">
                          <textarea 
                            value={week.theme}
                            onChange={(e) => handleWeekChange(idx, 'theme', e.target.value)}
                            className="w-full bg-transparent rounded p-2 text-stone-800 outline-none focus:bg-white resize-none min-h-[80px] h-full custom-scrollbar text-[15px] font-medium transition-colors"
                            placeholder="輸入主題..."
                          />
                        </td>
                        <td className="p-2 bg-white/50 align-top">
                          <textarea 
                            value={week.objectives || ''}
                            onChange={(e) => handleWeekChange(idx, 'objectives', e.target.value)}
                            className="w-full bg-transparent rounded p-2 text-stone-800 outline-none focus:bg-white resize-none min-h-[80px] h-full custom-scrollbar text-[15px] font-medium transition-colors"
                            placeholder="輸入課程目標..."
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
