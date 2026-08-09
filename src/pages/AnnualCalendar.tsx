import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar, Loader2, X, Plus, ArrowUpDown } from 'lucide-react';
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

// Pre-defined pastel colors for blocks to distinguish them
const blockColors = [
  'bg-yellow-200 hover:bg-yellow-300 border-yellow-400',
  'bg-blue-200 hover:bg-blue-300 border-blue-400',
  'bg-green-200 hover:bg-green-300 border-green-400',
  'bg-pink-200 hover:bg-pink-300 border-pink-400',
  'bg-purple-200 hover:bg-purple-300 border-purple-400',
  'bg-orange-200 hover:bg-orange-300 border-orange-400',
  'bg-teal-200 hover:bg-teal-300 border-teal-400'
];

export default function AnnualCalendar() {
  const [globalYear, setGlobalYear] = useState('114');
  const [semester, setSemester] = useState('上學期');
  const [startDate, setStartDate] = useState('');
  const [weeks, setWeeks] = useState<WeekData[]>(Array(21).fill({ theme: '', events: '', objectives: '', days: Array(7).fill('') }));
  const [loading, setLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  // Learning Indicators state
  const [indicators, setIndicators] = useState<any[]>([]);
  const [indSelections, setIndSelections] = useState({
    age: '', domain: '', ability: '', aspect: '', objective: ''
  });

  // Unified Modal for Add / Edit
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    isEdit: boolean;
    fieldType: 'events' | 'theme' | 'objectives';
    group?: any; // Only needed for 'events'
    weekIdx?: number; // Only needed for 'theme' and 'objectives'
    toWeekIdx?: number; // Used for multi-week theme application
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
    const unsubInd = onSnapshot(collection(db, 'bear_indicators'), (snap) => {
      setIndicators(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsub();
      unsubInd();
    };
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [globalYear, semester, docId]);

  const saveToDb = async (newWeeks: WeekData[], newStartDate?: string) => {
    try {
      await setDoc(doc(db, 'bear_annualEvents', docId), {
        startDate: newStartDate || startDate,
        weeks: newWeeks
      }, { merge: true });
    } catch (error) {
      console.error("Auto-save failed", error);
      alert('自動儲存失敗，請檢查網路連線');
    }
  };

  const handleMonthEventsChange = (group: { month: number, weeks: { week: WeekData, idx: number }[] }, value: string) => {
    const newWeeks = [...weeks];
    group.weeks.forEach(item => {
      newWeeks[item.idx] = { ...newWeeks[item.idx], events: value };
    });
    setWeeks(newWeeks);
    saveToDb(newWeeks);
  };

  const handleWeekChange = (index: number, field: keyof WeekData, value: string) => {
    const newWeeks = [...weeks];
    newWeeks[index] = { ...newWeeks[index], [field]: value };
    setWeeks(newWeeks);
    saveToDb(newWeeks);
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
    if (rawText.includes('---')) {
      return rawText.split(/\n*\s*---\s*\n*/).filter(b => b.trim() !== '');
    }
    if (rawText.trim() === '') return [];
    return [rawText.trim()];
  };

  const saveModalContent = () => {
    if (!actionModal) return;
    const { isEdit, fieldType, group, weekIdx, toWeekIdx, blockIndex, text, hasDate, dateY, dateM, dateD } = actionModal;
    
    let finalContent = text.trim();
    if (hasDate && finalContent) {
      finalContent = `${dateY}/${dateM}/${dateD}: ${finalContent}`;
    }

    if (fieldType === 'theme' && weekIdx !== undefined) {
      // Handle multi-week theme addition and modification
      const endIdx = (toWeekIdx !== undefined && toWeekIdx >= weekIdx) ? toWeekIdx : weekIdx;
      const newWeeks = [...weeks];
      for (let i = weekIdx; i <= endIdx; i++) {
        const blocks = getBlocks(newWeeks[i].theme);
        if (isEdit && blockIndex !== undefined) {
          if (i === weekIdx) {
            if (finalContent === '') blocks.splice(blockIndex, 1);
            else blocks[blockIndex] = finalContent;
          } else {
            // For subsequent weeks in the range, we also replace the same blockIndex if it exists, or push if it doesn't
            if (finalContent === '') {
              if (blocks.length > blockIndex) blocks.splice(blockIndex, 1);
            } else {
              blocks[blockIndex] = finalContent;
            }
          }
        } else {
          if (finalContent !== '') {
            blocks.push(finalContent);
          }
        }
        newWeeks[i] = { ...newWeeks[i], theme: blocks.join('\n\n---\n\n') };
      }
      setWeeks(newWeeks);
      saveToDb(newWeeks);
      setActionModal(null);
      return;
    }

    let rawText = '';
    if (fieldType === 'events') {
      rawText = group.weeks[0].week.events;
    } else {
      rawText = weeks[weekIdx!].objectives || '';
    }

    const blocks = getBlocks(rawText);

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

    const newValue = blocks.join('\n\n---\n\n');

    if (fieldType === 'events') {
      handleMonthEventsChange(group, newValue);
    } else {
      handleWeekChange(weekIdx!, fieldType, newValue);
    }
    setActionModal(null);
  };

  const deleteModalContent = () => {
    if (!actionModal || !actionModal.isEdit || actionModal.blockIndex === undefined) return;
    const { fieldType, group, weekIdx, blockIndex } = actionModal;
    
    let rawText = '';
    if (fieldType === 'events') {
      rawText = group.weeks[0].week.events;
    } else if (fieldType === 'theme') {
      rawText = weeks[weekIdx!].theme;
    } else {
      rawText = weeks[weekIdx!].objectives || '';
    }

    const blocks = getBlocks(rawText);
    blocks.splice(blockIndex, 1);
    const newValue = blocks.join('\n\n---\n\n');

    if (fieldType === 'events') {
      handleMonthEventsChange(group, newValue);
    } else {
      handleWeekChange(weekIdx!, fieldType, newValue);
    }
    setActionModal(null);
  };

  const sortBlocksByDate = (group: any) => {
    const rawText = group.weeks[0].week.events;
    const blocks = getBlocks(rawText);
    blocks.sort((a, b) => {
      const dateA = a.match(/^(\d+)\/(\d+)\/(\d+):/);
      const dateB = b.match(/^(\d+)\/(\d+)\/(\d+):/);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      const timeA = new Date(parseInt(dateA[1]) + 1911, parseInt(dateA[2]) - 1, parseInt(dateA[3])).getTime();
      const timeB = new Date(parseInt(dateB[1]) + 1911, parseInt(dateB[2]) - 1, parseInt(dateB[3])).getTime();
      return timeA - timeB;
    });
    handleMonthEventsChange(group, blocks.join('\n\n---\n\n'));
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in space-y-6">
      <ConfirmModal 
        isOpen={!!alertMessage}
        type="alert"
        title="注意"
        message={alertMessage}
        onConfirm={() => setAlertMessage('')}
        onCancel={() => setAlertMessage('')}
      />
      <ConfirmModal 
        isOpen={confirmDelete}
        type="confirm"
        title="確認刪除"
        message="確定要刪除這筆內容嗎？此動作無法復原。"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteModalContent();
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Unified Action Modal */}
      <AnimatePresence>
        {actionModal?.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActionModal(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="chalk-box relative z-10 max-w-md w-full bg-[#2b5b3f] shadow-2xl p-6">
              <div className="flex justify-between items-center mb-4 border-b border-white/20 pb-3">
                <h3 className="text-xl font-bold text-yellow-300">
                  {actionModal.isEdit ? '修改內容' : '新增內容'}
                </h3>
                <button onClick={() => setActionModal(null)} className="text-white/50 hover:text-white"><X className="w-6 h-6" /></button>
              </div>

              {actionModal.fieldType === 'theme' && (
                <div className="mb-4 bg-black/20 p-3 rounded-lg border border-white/10 flex items-center gap-3 text-white font-bold">
                  <span>套用到週次：</span>
                  <span>第 {actionModal.weekIdx !== undefined ? actionModal.weekIdx + 1 : 1} 週</span>
                  <span>~</span>
                  <select 
                    value={actionModal.toWeekIdx !== undefined ? actionModal.toWeekIdx : actionModal.weekIdx}
                    onChange={(e) => setActionModal({...actionModal, toWeekIdx: parseInt(e.target.value)})}
                    className="bg-white text-black font-bold px-2 py-1 rounded outline-none"
                  >
                    {weeks.map((_, i) => {
                      if (i < (actionModal.weekIdx || 0)) return null;
                      return <option key={i} value={i}>第 {i + 1} 週</option>;
                    })}
                  </select>
                </div>
              )}

              {actionModal.fieldType === 'events' && (
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

              {actionModal.fieldType === 'objectives' && (
                <div className="mb-4 bg-black/20 p-3 rounded-lg border border-white/10 space-y-3">
                  <div className="text-yellow-300 font-bold mb-2">新增幼兒園學習指標</div>
                  <div className="flex flex-wrap gap-2">
                    <select value={indSelections.age} onChange={e => setIndSelections({ age: e.target.value, domain: '', ability: '', aspect: '', objective: '' })} className="chalk-input text-black bg-white rounded p-1">
                      <option value="">選擇年齡</option>
                      <option value="age23">2-3 歲</option>
                      <option value="age34">3-4 歲</option>
                      <option value="age45">4-5 歲</option>
                      <option value="age56">5-6 歲</option>
                    </select>
                    
                    {indSelections.age && (
                      <select value={indSelections.domain} onChange={e => setIndSelections({ ...indSelections, domain: e.target.value, ability: '', aspect: '', objective: '' })} className="chalk-input text-black bg-white rounded p-1">
                        <option value="">選擇領域</option>
                        {[...new Set(indicators.filter(i => i[indSelections.age]).map(i => i.domain))].filter(Boolean).map(d => <option key={d as string} value={d as string}>{d as string}</option>)}
                      </select>
                    )}
                    
                    {indSelections.domain && (
                      <select value={indSelections.ability} onChange={e => setIndSelections({ ...indSelections, ability: e.target.value, aspect: '', objective: '' })} className="chalk-input text-black bg-white rounded p-1">
                        <option value="">選擇能力</option>
                        {[...new Set(indicators.filter(i => i[indSelections.age] && i.domain === indSelections.domain).map(i => i.ability))].filter(Boolean).map(a => <option key={a as string} value={a as string}>{a as string}</option>)}
                      </select>
                    )}
                    
                    {indSelections.ability && (
                      <select value={indSelections.aspect} onChange={e => setIndSelections({ ...indSelections, aspect: e.target.value, objective: '' })} className="chalk-input text-black bg-white rounded p-1">
                        <option value="">選擇面向</option>
                        {[...new Set(indicators.filter(i => i[indSelections.age] && i.domain === indSelections.domain && i.ability === indSelections.ability).map(i => i.aspect))].filter(Boolean).map(a => <option key={a as string} value={a as string}>{a as string}</option>)}
                      </select>
                    )}
                    
                    {indSelections.aspect && (
                      <select value={indSelections.objective} onChange={e => setIndSelections({ ...indSelections, objective: e.target.value })} className="chalk-input text-black bg-white rounded p-1 max-w-[200px]">
                        <option value="">選擇課程目標</option>
                        {[...new Set(indicators.filter(i => i[indSelections.age] && i.domain === indSelections.domain && i.ability === indSelections.ability && i.aspect === indSelections.aspect).map(i => i.objective))].filter(Boolean).map(o => <option key={o as string} value={o as string}>{o as string}</option>)}
                      </select>
                    )}
                  </div>
                  
                  {indSelections.objective && (
                    <div className="mt-2 text-right">
                      <button 
                        type="button"
                        onClick={() => {
                          const targetInd = indicators.find(i => i[indSelections.age] && i.domain === indSelections.domain && i.ability === indSelections.ability && i.aspect === indSelections.aspect && i.objective === indSelections.objective);
                          if (targetInd) {
                            const currentText = actionModal.text;
                            const newText = currentText ? `${currentText}\n${targetInd[indSelections.age]}` : targetInd[indSelections.age];
                            setActionModal({ ...actionModal, text: newText });
                          }
                        }}
                        className="chalk-btn py-1 px-3 bg-green-600/80 hover:bg-green-500 font-bold text-sm"
                      >
                        加入內容
                      </button>
                    </div>
                  )}
                </div>
              )}

              <textarea 
                value={actionModal.text} 
                onChange={(e) => setActionModal({...actionModal, text: e.target.value})} 
                className="chalk-input w-full min-h-[120px] resize-none bg-white text-black font-bold p-3 rounded mb-4" 
                placeholder="請輸入內容 (可換行輸入多行內容)..." 
                autoFocus
              />
              <div className="flex justify-between gap-3">
                {actionModal.isEdit ? (
                  <button onClick={() => setConfirmDelete(true)} className="chalk-btn bg-red-600/80 text-white hover:bg-red-500 font-bold px-6">刪除</button>
                ) : (
                  <div />
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
              onChange={(e) => { 
                const newDate = e.target.value;
                setStartDate(newDate); 
                saveToDb(weeks, newDate);
              }} 
              className="chalk-input bg-white/10 px-2 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center text-yellow-300 font-bold bg-black/20 px-3 py-1.5 rounded-full text-sm">
            ✓ 編輯內容將自動儲存
          </div>
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
                                 
                                 const datePrefix = `${yStr}/${mStr}/${dStr}:`;
                                 const hasEvent = group.weeks[0].week.events.includes(datePrefix);
                                 if (hasEvent) {
                                   setAlertMessage(`注意：${yStr}/${mStr}/${dStr} 已經有安排活動了！`);
                                 }

                                 setActionModal({ 
                                   isOpen: true, 
                                   isEdit: false, 
                                   fieldType: 'events',
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
                          <td rowSpan={group.weeks.length} className="p-2 border-r-2 border-black/80 bg-white/50 align-top h-full relative group/td">
                            <div className="absolute top-2 right-2 z-10 flex gap-1">
                              <button 
                                onClick={() => sortBlocksByDate(group)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded flex items-center gap-1 text-xs shadow transition-colors"
                                title="依日期排序活動"
                              >
                                <ArrowUpDown className="w-3 h-3" />
                                排序
                              </button>
                              <button 
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  isEdit: false,
                                  fieldType: 'events',
                                  group: group,
                                  text: '',
                                  hasDate: false,
                                  dateY: globalYear,
                                  dateM: String(group.month).padStart(2, '0'),
                                  dateD: '01'
                                })}
                                className="bg-stone-700 hover:bg-stone-800 text-white font-bold px-2 py-1 rounded flex items-center gap-1 text-xs shadow transition-colors"
                                title="在此月份新增活動"
                              >
                                <Plus className="w-3 h-3" />
                                新增
                              </button>
                            </div>

                            <div className="flex flex-col h-full min-h-[120px] gap-2 pt-8">
                              <div className="flex-1 flex flex-col gap-2">
                                {getBlocks(week.events).map((blockText, blockIndex) => {
                                  const colorClass = blockColors[blockIndex % blockColors.length];
                                  
                                  // Parse Date and Day of Week
                                  let dateBadge = null;
                                  let contentText = blockText;
                                  let parsedHasDate = false;
                                  let pY = globalYear;
                                  let pM = '01';
                                  let pD = '01';
                                  
                                  const match = blockText.match(/^(\d{3,4})\/(\d{2})\/(\d{2}):\s*(.*)/s);
                                  if (match) {
                                    const [_, y, m, d, rest] = match;
                                    parsedHasDate = true;
                                    pY = y;
                                    pM = m;
                                    pD = d;
                                    contentText = rest;
                                    
                                    const dateObj = new Date(parseInt(y) + 1911, parseInt(m) - 1, parseInt(d));
                                    const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];
                                    dateBadge = (
                                      <div className="bg-stone-800 text-yellow-300 px-2 py-0.5 rounded text-sm mb-1 inline-block shadow-sm">
                                        {`${y}/${m}/${d} (星期${dayOfWeek})`}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div 
                                      key={blockIndex} 
                                      onClick={() => setActionModal({
                                        isOpen: true,
                                        isEdit: true,
                                        fieldType: 'events',
                                        group: group,
                                        blockIndex: blockIndex,
                                        text: contentText,
                                        hasDate: parsedHasDate,
                                        dateY: pY,
                                        dateM: pM,
                                        dateD: pD
                                      })}
                                      className={`${colorClass} border-2 text-stone-800 px-2.5 py-2 rounded shadow-sm text-[15px] font-bold cursor-pointer transition-transform hover:-translate-y-0.5 leading-relaxed`}
                                      title="點擊修改或刪除活動"
                                    >
                                      {dateBadge}
                                      <div className="whitespace-pre-wrap">{contentText}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="p-2 border-r-2 border-black/80 bg-white/50 align-top relative group/td">
                            <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/td:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  isEdit: false,
                                  fieldType: 'theme',
                                  weekIdx: idx,
                                  toWeekIdx: idx,
                                  text: '',
                                  hasDate: false,
                                  dateY: globalYear,
                                  dateM: '01',
                                  dateD: '01'
                                })}
                                className="bg-stone-700 hover:bg-stone-800 text-white font-bold p-1 rounded shadow transition-colors"
                                title="新增主題"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex flex-col h-full min-h-[80px] gap-2 pt-6">
                              {getBlocks(week.theme).map((blockText, blockIndex) => {
                                const colorClass = blockColors[(blockIndex + 2) % blockColors.length]; // Offset color for variety
                                return (
                                  <div 
                                    key={blockIndex} 
                                    onClick={() => setActionModal({
                                      isOpen: true,
                                      isEdit: true,
                                      fieldType: 'theme',
                                      weekIdx: idx,
                                      blockIndex: blockIndex,
                                      text: blockText,
                                      hasDate: false,
                                      dateY: globalYear,
                                      dateM: '01',
                                      dateD: '01'
                                    })}
                                    className={`${colorClass} border-2 text-stone-800 px-2 py-1.5 rounded shadow-sm text-sm font-bold cursor-pointer transition-transform hover:-translate-y-0.5 whitespace-pre-wrap leading-relaxed`}
                                    title="點擊修改或刪除"
                                  >
                                    {blockText}
                                  </div>
                                );
                              })}
                            </div>
                        </td>
                        <td className="p-2 bg-white/50 align-top relative group/td">
                            <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/td:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setActionModal({
                                  isOpen: true,
                                  isEdit: false,
                                  fieldType: 'objectives',
                                  weekIdx: idx,
                                  text: '',
                                  hasDate: false,
                                  dateY: globalYear,
                                  dateM: '01',
                                  dateD: '01'
                                })}
                                className="bg-stone-700 hover:bg-stone-800 text-white font-bold p-1 rounded shadow transition-colors"
                                title="新增課程目標"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex flex-col h-full min-h-[80px] gap-2 pt-6">
                              {getBlocks(week.objectives || '').map((blockText, blockIndex) => {
                                const colorClass = blockColors[(blockIndex + 4) % blockColors.length]; // Offset color for variety
                                return (
                                  <div 
                                    key={blockIndex} 
                                    onClick={() => setActionModal({
                                      isOpen: true,
                                      isEdit: true,
                                      fieldType: 'objectives',
                                      weekIdx: idx,
                                      blockIndex: blockIndex,
                                      text: blockText,
                                      hasDate: false,
                                      dateY: globalYear,
                                      dateM: '01',
                                      dateD: '01'
                                    })}
                                    className={`${colorClass} border-2 text-stone-800 px-2 py-1.5 rounded shadow-sm text-sm font-bold cursor-pointer transition-transform hover:-translate-y-0.5 whitespace-pre-wrap leading-relaxed`}
                                    title="點擊修改或刪除"
                                  >
                                    {blockText}
                                  </div>
                                );
                              })}
                            </div>
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
