import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Calendar as CalendarIcon, Loader2, FileText, Plus, Trash2, X, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

interface WeeklyEntry {
  weather: string;
  act: string;
  motor: string;
  ref: string;
  ane: string;
  com: string;
}

interface BulletinNote {
  id: string;
  text: string;
  color: string;
  createdAt: number;
}

const POST_IT_COLORS = [
  'bg-yellow-200 text-black',
  'bg-pink-200 text-black',
  'bg-blue-200 text-black',
  'bg-green-200 text-black'
];

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
  const [bulletinNotes, setBulletinNotes] = useState<BulletinNote[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(null);
  const [confirmDeleteEventIndex, setConfirmDeleteEventIndex] = useState<number | null>(null);
  
  const [classEventsDoc, setClassEventsDoc] = useState<Record<string, any>>({});
  const [calendarActionModal, setCalendarActionModal] = useState<{ isOpen: boolean, dateStr: string }>({ isOpen: false, dateStr: '' });
  const [eventInputModal, setEventInputModal] = useState<{ isOpen: boolean, hasDate: boolean, dateY: string, dateM: string, dateD: string, isEditing: boolean, editingIndex: number, text: string }>({ isOpen: false, hasDate: false, dateY: '114', dateM: '01', dateD: '01', isEditing: false, editingIndex: -1, text: '' });
  const [themeInputModal, setThemeInputModal] = useState<{ isOpen: boolean, text: string }>({ isOpen: false, text: '' });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean, message: string }>({ isOpen: false, message: '' });
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);

  // Events List Pagination
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize, setEventsPageSize] = useState(3);

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
  let schoolEventsText = '';
  const docId = `${settings.academicYear}_${settings.semester}`;
  const annualDoc = annualEvents[docId];
  if (annualDoc && annualDoc.startDate) {
    const st = new Date(annualDoc.startDate);
    const curr = new Date(currentDate);
    const diffTime = curr.getTime() - st.getTime();
    viewingWeek = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
    if (annualDoc.weeks && annualDoc.weeks[viewingWeek - 1]) {
      currentTheme = annualDoc.weeks[viewingWeek - 1].theme || currentTheme;
      schoolEventsText = annualDoc.weeks[viewingWeek - 1].events || '';
    }
  }

  // Override with class custom theme if exists
  const classCustomTheme = classEventsDoc[docId]?.themes?.[viewingWeek];
  const displayTheme = classCustomTheme !== undefined ? classCustomTheme : currentTheme;

  const getBlocks = (rawText: string) => {
    if (!rawText) return [];
    if (rawText.includes('---')) {
      return rawText.split(/\n*\s*---\s*\n*/).filter(b => b.trim() !== '');
    }
    if (rawText.trim() === '') return [];
    return [rawText.trim()];
  };

  const schoolEventsList = getBlocks(schoolEventsText);
  const classEventsList = (classEventsDoc[docId]?.weeks?.[viewingWeek] || []) as string[];

  const combinedEvents = [
    ...schoolEventsList.map((text, i) => ({ type: 'school' as const, text, originalIndex: i })),
    ...classEventsList.map((text, i) => ({ type: 'class' as const, text, originalIndex: i }))
  ];
  
  const enrolledCount = students.filter(s => s.academicYear === settings.academicYear && (s.status === '在學' || !s.status)).length;

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
      else setLeaves({});
    });

    const unsubSettings = onSnapshot(doc(db, 'bear_settings', 'main'), (snap) => {
      if (snap.exists()) setSettings((prev: any) => ({ ...prev, ...snap.data() }));
    });

    const unsubAnnual = onSnapshot(collection(db, 'bear_annualEvents'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setAnnualEvents(data);
    });
    
    const unsubClassEvents = onSnapshot(collection(db, 'bear_classEvents'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setClassEventsDoc(data);
    });

    const unsubAtt = onSnapshot(collection(db, 'bear_attendance'), (snap) => {
      const data: Record<string, any> = {};
      snap.docs.forEach(d => { data[d.id] = d.data().records || {}; });
      setAttendance(data);
    });

    const unsubBulletin = onSnapshot(doc(db, 'bear_settings', 'bulletin'), (snap) => {
      if (snap.exists()) setBulletinNotes(snap.data().notes || []);
    });
    
    const unsubStudents = onSnapshot(collection(db, 'bear_students'), (snap) => {
      setStudents(snap.docs.map(d => d.data()));
    });

    const unsubTeachers = onSnapshot(collection(db, 'bear_teachers'), (snap) => {
      setTeachers(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
    });

    return () => {
      unsubEntries();
      unsubLeaves();
      unsubSettings();
      unsubAnnual();
      unsubClassEvents();
      unsubAtt();
      unsubBulletin();
      unsubStudents();
      unsubTeachers();
    };
  }, []);

  // Fetch live weather when date changes
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
    try {
      const data = entries[`${date}_0`] || {};
      await setDoc(doc(db, 'bear_scheduleEntries', `${date}_0`), data, { merge: true });
    } catch (error) {
      console.error(error);
      setAlertModal({ isOpen: true, message: '儲存日誌失敗' });
    }
  };

  const navWeek = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (dir * 7));
    setCurrentDate(d.toISOString().split('T')[0]);
    setEventsPage(1); // Reset page on week change
  };

  // Bulletin Board Functions
  const saveBulletin = async (newNotes: BulletinNote[]) => {
    try {
      await setDoc(doc(db, 'bear_settings', 'bulletin'), { notes: newNotes }, { merge: true });
    } catch (e) {
      console.error(e);
    }
  };

  const addNote = (initialText = '') => {
    const color = POST_IT_COLORS[bulletinNotes.length % POST_IT_COLORS.length];
    const newNotes = [...bulletinNotes, { id: Date.now().toString(), text: initialText, color, createdAt: Date.now() }];
    saveBulletin(newNotes);
  };

  const updateNote = (id: string, text: string) => {
    const newNotes = bulletinNotes.map(n => n.id === id ? { ...n, text } : n);
    setBulletinNotes(newNotes); // optimistic update
  };

  const blurNote = () => {
    saveBulletin(bulletinNotes);
  };

  const executeDeleteNote = () => {
    if(confirmDeleteNoteId) {
      const newNotes = bulletinNotes.filter(n => n.id !== confirmDeleteNoteId);
      saveBulletin(newNotes);
      setConfirmDeleteNoteId(null);
    }
  };

  const sortBulletinByDate = () => {
    const parseDate = (text: string) => {
      const m = text.match(/^(\d{2})\/(\d{2})/);
      if (m) {
        const d = new Date();
        d.setMonth(parseInt(m[1], 10) - 1, parseInt(m[2], 10));
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }
      return null;
    };

    const sorted = [...bulletinNotes].sort((a, b) => {
      const da = parseDate(a.text);
      const db = parseDate(b.text);
      if (da && db) return da - db;
      if (da) return -1;
      if (db) return 1;
      return a.createdAt - b.createdAt;
    });
    setBulletinNotes(sorted);
    saveBulletin(sorted);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndexStr = e.dataTransfer.getData('text/plain');
    if (!dragIndexStr) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (dragIndex === dropIndex) return;

    const newNotes = [...bulletinNotes];
    const [draggedNote] = newNotes.splice(dragIndex, 1);
    newNotes.splice(dropIndex, 0, draggedNote);
    saveBulletin(newNotes);
    setBulletinNotes(newNotes); // optimistic
  };

  // Calendar & Events click actions
  const handleActionAddNote = () => {
    const dateFormatted = calendarActionModal.dateStr.substring(5).replace('-', '/');
    addNote(`${dateFormatted}: `);
    setCalendarActionModal({ isOpen: false, dateStr: '' });
  };

  const handleActionAddEvent = () => {
    const dStr = calendarActionModal.dateStr; // e.g. "2025-08-31"
    const [y, m, d] = dStr.split('-');
    const dateY = String(parseInt(y) - 1911);
    
    setCalendarActionModal({ isOpen: false, dateStr: '' });
    setEventInputModal({ 
      isOpen: true, 
      hasDate: true, 
      dateY, 
      dateM: m, 
      dateD: d, 
      isEditing: false, 
      editingIndex: -1, 
      text: '' 
    });
  };

  const saveEventAction = async () => {
    const { isEditing, editingIndex, text, hasDate, dateY, dateM, dateD } = eventInputModal;
    let finalContent = text.trim();
    
    if (!finalContent && hasDate) {
      // Allow saving just the date, or maybe warn?
      // Let's just use what they have.
    }
    
    if (hasDate && finalContent) {
      finalContent = `${dateY}/${dateM}/${dateD}: ${finalContent}`;
    } else if (hasDate && !finalContent) {
      finalContent = `${dateY}/${dateM}/${dateD}: `;
    }

    if (!finalContent.trim()) { 
      setAlertModal({ isOpen: true, message: '請輸入活動內容' });
      return; 
    }

    const finalEventText = finalContent;
    
    const existingDoc = classEventsDoc[docId] || {};
    const existingWeeks = existingDoc.weeks || {};
    const currentList = [...classEventsList];
    
    if (isEditing && editingIndex !== -1) {
      currentList[editingIndex] = finalEventText;
    } else {
      currentList.push(finalEventText);
    }
    
    const newDocData = {
      ...existingDoc,
      weeks: {
        ...existingWeeks,
        [viewingWeek]: currentList
      }
    };
    
    try {
      await setDoc(doc(db, 'bear_classEvents', docId), newDocData, { merge: true });
      setEventInputModal({ isOpen: false, hasDate: false, dateY: '114', dateM: '01', dateD: '01', isEditing: false, editingIndex: -1, text: '' });
      setAlertModal({ isOpen: true, message: '活動儲存成功！' });
    } catch(e) {
      setAlertModal({ isOpen: true, message: '儲存活動失敗，請稍後再試。' });
    }
  };

  const executeDeleteEvent = async () => {
    if (confirmDeleteEventIndex === null) return;
    const existingDoc = classEventsDoc[docId] || {};
    const existingWeeks = existingDoc.weeks || {};
    const currentList = [...classEventsList];
    
    currentList.splice(confirmDeleteEventIndex, 1);
    
    const newDocData = {
      ...existingDoc,
      weeks: {
        ...existingWeeks,
        [viewingWeek]: currentList
      }
    };
    
    try {
      await setDoc(doc(db, 'bear_classEvents', docId), newDocData, { merge: true });
      setConfirmDeleteEventIndex(null);
    } catch(e) {
      setAlertModal({ isOpen: true, message: '刪除活動失敗，請稍後再試。' });
    }
  }

  const saveThemeAction = async () => {
    if (!themeInputModal.text.trim()) { 
      setAlertModal({ isOpen: true, message: '請輸入教學主題' });
      return; 
    }
    
    const existingDoc = classEventsDoc[docId] || {};
    const existingThemes = existingDoc.themes || {};
    
    const newDocData = {
      ...existingDoc,
      themes: {
        ...existingThemes,
        [viewingWeek]: themeInputModal.text
      }
    };
    
    try {
      await setDoc(doc(db, 'bear_classEvents', docId), newDocData, { merge: true });
      setThemeInputModal({ isOpen: false, text: '' });
      setAlertModal({ isOpen: true, message: '教學主題儲存成功！' });
    } catch(e) {
      setAlertModal({ isOpen: true, message: '儲存教學主題失敗，請稍後再試。' });
    }
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
            <h3>本週主題：${displayTheme}</h3>
            <div class="att-summary">在籍：${enrolledCount}人 &nbsp;|&nbsp; 出席：${pCount}人 &nbsp;|&nbsp; 請假：${lCount}人</div>
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

  const getTeacherColor = (name: string) => {
    if (name === settings.leadTeacher) return { bg: 'bg-purple-600 border-purple-400', text: 'text-purple-300' };
    if (name === settings.coTeacher) return { bg: 'bg-blue-600 border-blue-400', text: 'text-blue-300' };
    
    const preset = [
        { bg: 'bg-pink-600 border-pink-400', text: 'text-pink-300' },
        { bg: 'bg-teal-600 border-teal-400', text: 'text-teal-300' },
        { bg: 'bg-orange-600 border-orange-400', text: 'text-orange-300' }
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return preset[hash % preset.length];
  };

  const renderMiniMonthCalendar = () => {
    const current = new Date(currentDate);
    const y = current.getFullYear();
    const m = current.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevMonthDays = new Date(y, m, 0).getDate();

    // Generate 42 cells (6 weeks)
    const calendarCells = [];
    
    // Previous month dates
    for (let i = 0; i < firstDay; i++) {
      const d = prevMonthDays - firstDay + 1 + i;
      const dateStr = `${m === 0 ? y - 1 : y}-${String(m === 0 ? 12 : m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendarCells.push({ d, dateStr, isCurrentMonth: false });
    }
    
    // Current month dates
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      calendarCells.push({ d: i, dateStr, isCurrentMonth: true });
    }
    
    // Next month dates
    const remaining = 42 - calendarCells.length;
    for (let i = 1; i <= remaining; i++) {
      const dateStr = `${m === 11 ? y + 1 : y}-${String(m === 11 ? 1 : m + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      calendarCells.push({ d: i, dateStr, isCurrentMonth: false });
    }

    return (
      <div className="bg-black/30 p-4 rounded-xl border border-white/20 w-full shadow-inner mt-4">
        <div className="text-center font-bold text-yellow-300 text-xl mb-4">{m + 1}月 月曆</div>
        <div className="grid grid-cols-7 gap-2 text-center text-white/50 mb-2 font-bold">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-lg">
          {calendarCells.map((cell, idx) => {
            const { d, dateStr, isCurrentMonth } = cell;
            const isWeekDay = weekDays.includes(dateStr);
            const teacherLeave = leaves[dateStr];
            let classes = "rounded-md py-1.5 transition-colors cursor-pointer ";
            
            if (teacherLeave) classes += `${getTeacherColor(teacherLeave).bg} font-bold shadow-lg text-sm flex items-center justify-center text-white `;
            else if (isWeekDay) classes += "bg-yellow-500/30 font-bold outline outline-2 outline-yellow-400 flex items-center justify-center hover:bg-yellow-500/50 text-white ";
            else if (isCurrentMonth) classes += "text-white/80 hover:bg-white/10 flex items-center justify-center ";
            else classes += "text-white/20 hover:bg-white/5 flex items-center justify-center ";

            return (
              <div 
                key={idx} 
                className={classes} 
                title={teacherLeave ? `${teacherLeave}請假` : '點擊新增活動/便利貼'}
                onClick={() => setCalendarActionModal({ isOpen: true, dateStr })}
              >
                {teacherLeave ? <span className="text-[10px] leading-none whitespace-nowrap">{teacherLeave[0]}假</span> : d}
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 flex justify-center flex-wrap gap-4 text-xs font-bold text-white/70">
          <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500/30 border border-yellow-400 rounded-sm"></div>本週</div>
          {teachers.map(t => (
            <div key={t.id} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${getTeacherColor(t.name).bg.split(' ')[0]} border ${getTeacherColor(t.name).bg.split(' ')[1] || 'border-transparent'}`}></div>
              {t.name}請假
            </div>
          ))}
        </div>
      </div>
    );
  };

  const dayNames = ['星期一', '星期二', '星期三', '星期四', '星期五'];

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in space-y-4">
      <ConfirmModal 
        isOpen={!!confirmDeleteNoteId}
        type="confirm"
        title="確認撕下"
        message="確定要撕下這張便利貼嗎？此動作無法復原。"
        onConfirm={executeDeleteNote}
        onCancel={() => setConfirmDeleteNoteId(null)}
      />
      <ConfirmModal 
        isOpen={confirmDeleteEventIndex !== null}
        type="confirm"
        title="確認刪除活動"
        message="確定要刪除這筆活動嗎？此動作無法復原。"
        onConfirm={executeDeleteEvent}
        onCancel={() => setConfirmDeleteEventIndex(null)}
      />
      <ConfirmModal 
        isOpen={alertModal.isOpen}
        type="alert"
        title="系統提示"
        message={alertModal.message}
        onConfirm={() => setAlertModal({ isOpen: false, message: '' })}
        onCancel={() => setAlertModal({ isOpen: false, message: '' })}
      />

      <AnimatePresence>
        {calendarActionModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="chalk-box w-full max-w-sm relative bg-[#2b5b3f]"
            >
              <button 
                onClick={() => setCalendarActionModal({ isOpen: false, dateStr: '' })}
                className="absolute top-4 right-4 text-white/50 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-xl font-bold mb-6 text-yellow-300 text-center border-b border-white/20 pb-3">
                {calendarActionModal.dateStr.substring(5).replace('-', '/')} 日期操作
              </h2>
              <div className="flex flex-col gap-4">
                <button onClick={handleActionAddEvent} className="chalk-btn bg-blue-600/80 hover:bg-blue-500 py-3 text-lg font-bold shadow-lg w-full justify-center">
                  ➕ 新增活動 (至重點事項)
                </button>
                <button onClick={handleActionAddNote} className="chalk-btn bg-green-600/80 hover:bg-green-500 py-3 text-lg font-bold shadow-lg w-full justify-center">
                  📝 新增便利貼
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {eventInputModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="chalk-box w-full max-w-md relative bg-[#2b5b3f]"
            >
              <h2 className="text-xl font-bold mb-4 text-yellow-300 flex items-center gap-2 border-b border-white/20 pb-2">
                {eventInputModal.isEditing ? <PenTool className="w-5 h-5"/> : <Plus className="w-5 h-5"/>} 
                {eventInputModal.isEditing ? '修改活動內容' : '新增重點活動'}
              </h2>
              
              <div className="mb-4">
                <div className="mb-4 bg-black/20 p-3 rounded-lg border border-white/10">
                  <label className="flex items-center gap-2 text-white font-bold cursor-pointer mb-2">
                    <input 
                      type="checkbox" 
                      checked={eventInputModal.hasDate} 
                      onChange={(e) => setEventInputModal({...eventInputModal, hasDate: e.target.checked})}
                      className="w-4 h-4 accent-yellow-500"
                    />
                    加入日期
                  </label>
                  
                  {eventInputModal.hasDate && (
                    <div className="flex items-center gap-2 mt-2">
                      <select 
                        value={eventInputModal.dateY}
                        onChange={(e) => setEventInputModal({...eventInputModal, dateY: e.target.value})}
                        className="bg-white text-black font-bold px-2 py-1 rounded outline-none w-20 text-center"
                      >
                        <option value={settings.academicYear}>{settings.academicYear}</option>
                        <option value={String(parseInt(settings.academicYear) + 1)}>{parseInt(settings.academicYear) + 1}</option>
                      </select>
                      <span className="text-white/80 font-bold">年</span>
                      
                      <select 
                        value={eventInputModal.dateM}
                        onChange={(e) => setEventInputModal({...eventInputModal, dateM: e.target.value})}
                        className="bg-white text-black font-bold px-2 py-1 rounded outline-none w-16 text-center"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={i} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')}</option>
                        ))}
                      </select>
                      <span className="text-white/80 font-bold">月</span>

                      <select 
                        value={eventInputModal.dateD}
                        onChange={(e) => setEventInputModal({...eventInputModal, dateD: e.target.value})}
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
                <textarea 
                  value={eventInputModal.text}
                  onChange={(e) => setEventInputModal({ ...eventInputModal, text: e.target.value })}
                  className="chalk-input w-full min-h-[100px] resize-none bg-white text-black"
                  placeholder={eventInputModal.isEditing ? "請輸入修改的活動內容..." : "請輸入後續的活動內容..."}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEventInputModal({ isOpen: false, hasDate: false, dateY: '114', dateM: '01', dateD: '01', isEditing: false, editingIndex: -1, text: '' })} className="chalk-btn bg-black/20 text-white hover:bg-black/40">取消</button>
                <button onClick={saveEventAction} className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold px-6">儲存</button>
              </div>
            </motion.div>
          </div>
        )}
        
        {themeInputModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="chalk-box w-full max-w-md relative bg-[#2b5b3f]"
            >
              <h2 className="text-xl font-bold mb-4 text-yellow-300 flex items-center gap-2 border-b border-white/20 pb-2">
                <PenTool className="w-5 h-5"/> 手動輸入教學主題
              </h2>
              <div className="mb-4">
                <input 
                  type="text"
                  value={themeInputModal.text}
                  onChange={(e) => setThemeInputModal({ ...themeInputModal, text: e.target.value })}
                  className="chalk-input w-full bg-white text-black font-bold"
                  placeholder="請輸入本週教學主題..."
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setThemeInputModal({ isOpen: false, text: '' })} className="chalk-btn bg-black/20 text-white hover:bg-black/40">取消</button>
                <button onClick={saveThemeAction} className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold px-6">儲存</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin w-12 h-12 text-white/50" /></div>
      ) : (
        <>
          {/* 上方佈局 (1/3 左側, 2/3 右側) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側 1/3: 選擇週數與大月曆 */}
            <div className="chalk-box flex flex-col items-center">
              <div className="flex items-center gap-2 border-b border-white/20 pb-3 mb-4 w-full justify-center">
                <CalendarIcon className="w-6 h-6 text-yellow-300" />
                <h2 className="text-2xl font-bold tracking-widest text-center">第 {viewingWeek} 週排程</h2>
              </div>
              <div className="flex justify-between gap-2 w-full max-w-sm">
                <button onClick={() => navWeek(-1)} className="chalk-btn py-2 px-4 text-sm flex-1 font-bold">上一週</button>
                <input 
                  type="date" 
                  value={currentDate} 
                  onChange={(e) => setCurrentDate(e.target.value)} 
                  className="chalk-input bg-white/10 px-2 rounded py-0 text-center flex-1 font-bold text-lg"
                />
                <button onClick={() => navWeek(1)} className="chalk-btn py-2 px-4 text-sm flex-1 font-bold">下一週</button>
              </div>
              <div className="w-full max-w-sm">
                {renderMiniMonthCalendar()}
              </div>
            </div>

            {/* 右側 2/3: 資訊與公布欄 */}
            <div className="lg:col-span-2 chalk-box flex flex-col gap-6">
              {/* 教師與活動資訊 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/20 border border-white/20 rounded-xl p-5 shadow-inner">
                  <h3 className="text-yellow-200 font-bold mb-4 text-lg border-b border-white/10 pb-2">👥 本週班級導師</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded shadow">
                      <span className="text-white/70 font-bold">主班老師</span>
                      <span className="font-bold text-white tracking-widest text-xl">{displayLeadTeacher}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded shadow">
                      <span className="text-white/70 font-bold">協同老師</span>
                      <span className="font-bold text-white tracking-widest text-xl">{displayCoTeacher}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-black/20 border border-white/20 rounded-xl p-5 shadow-inner flex flex-col relative h-full">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-4">
                    <h3 className="text-yellow-200 font-bold text-lg">📌 本週重點活動</h3>
                    <button onClick={() => setEventInputModal({isOpen: true, hasDate: false, dateY: settings.academicYear, dateM: '01', dateD: '01', isEditing: false, editingIndex: -1, text: ''})} className="chalk-btn bg-green-600/80 hover:bg-green-500 text-xs px-2 py-1 font-bold">
                      <Plus className="w-3 h-3 inline mr-1"/>新增活動
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-[140px]">
                     {combinedEvents.length === 0 ? (
                       <div className="text-white/30 italic text-center mt-6 font-bold">尚無重點活動</div>
                     ) : (
                       combinedEvents.slice((eventsPage - 1) * eventsPageSize, eventsPage * eventsPageSize).map((ev, i) => {
                         const actualIndex = (eventsPage - 1) * eventsPageSize + i;
                         
                         let dateBadge = null;
                         let contentText = ev.text;
                         let parsedHasDate = false;
                         let pY = settings.academicYear;
                         let pM = '01';
                         let pD = '01';
                         
                         const match = ev.text.match(/^(\d{3,4})\/(\d{2})\/(\d{2}):\s*(.*)/s);
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
                             <div className="bg-stone-800 text-yellow-300 px-2 py-0.5 rounded text-xs mb-1 inline-block shadow-sm font-bold border border-yellow-500/30">
                               {`${y}/${m}/${d} (星期${dayOfWeek})`}
                             </div>
                           );
                         }

                         return (
                           <div key={actualIndex} className="bg-white/5 border border-white/10 rounded p-2 flex justify-between items-center group transition-colors hover:bg-white/10">
                             <div className="flex gap-2 items-start text-sm">
                               <span className="text-yellow-300 font-bold mt-1">{actualIndex + 1}.</span>
                               {ev.type === 'school' ? (
                                 <span className="bg-purple-600/50 text-purple-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-purple-400/50 mt-1 whitespace-nowrap">園所</span>
                               ) : (
                                 <span className="bg-blue-600/50 text-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold border border-blue-400/50 mt-1 whitespace-nowrap">班級</span>
                               )}
                               <div className="flex-1">
                                 {dateBadge}
                                 <div className="text-white/90 whitespace-pre-wrap leading-relaxed">{contentText}</div>
                               </div>
                             </div>
                             {ev.type === 'class' && (
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                                 <button 
                                   onClick={() => setEventInputModal({
                                     isOpen: true, 
                                     hasDate: parsedHasDate, 
                                     dateY: pY, 
                                     dateM: pM, 
                                     dateD: pD, 
                                     isEditing: true, 
                                     editingIndex: ev.originalIndex, 
                                     text: contentText
                                   })} 
                                   className="text-blue-300 hover:text-white p-1 rounded hover:bg-blue-500/50" 
                                   title="修改"
                                 >
                                   <PenTool className="w-4 h-4" />
                                 </button>
                                 <button onClick={() => setConfirmDeleteEventIndex(ev.originalIndex)} className="text-red-300 hover:text-white p-1 rounded hover:bg-red-500/50" title="刪除"><Trash2 className="w-4 h-4" /></button>
                               </div>
                             )}
                           </div>
                         )
                       })
                     )}
                  </div>
                  
                  {combinedEvents.length > 0 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-white/10 text-xs">
                       <div className="flex gap-2 items-center">
                         <select value={eventsPageSize} onChange={e => {setEventsPageSize(Number(e.target.value)); setEventsPage(1);}} className="chalk-input bg-black/50 py-0.5 text-xs text-yellow-100 font-bold px-1">
                           <option value={3}>3 筆/頁</option>
                           <option value={6}>6 筆/頁</option>
                           <option value={9}>9 筆/頁</option>
                         </select>
                       </div>
                       <div className="flex gap-2 items-center font-bold">
                         <button onClick={() => setEventsPage(p => Math.max(1, p - 1))} disabled={eventsPage === 1} className="chalk-btn py-0.5 px-2 text-xs bg-white/10 disabled:opacity-50">上一頁</button>
                         <span className="text-yellow-200">{eventsPage} / {Math.ceil(combinedEvents.length / eventsPageSize) || 1}</span>
                         <button onClick={() => setEventsPage(p => Math.min(Math.ceil(combinedEvents.length / eventsPageSize), p + 1))} disabled={eventsPage === Math.ceil(combinedEvents.length / eventsPageSize)} className="chalk-btn py-0.5 px-2 text-xs bg-white/10 disabled:opacity-50">下一頁</button>
                       </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 班級公布欄 */}
              <div className="flex-1 bg-black/20 border border-white/20 rounded-xl p-5 shadow-inner flex flex-col min-h-[260px]">
                <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-2">
                  <h3 className="text-yellow-200 font-bold text-xl flex items-center gap-2">
                    📝 班級公布欄
                  </h3>
                  <div className="flex gap-2">
                    <button onClick={sortBulletinByDate} className="chalk-btn bg-blue-600/80 hover:bg-blue-500 py-1.5 px-3 text-sm flex items-center shadow-lg font-bold">
                      依日期排序
                    </button>
                    <button onClick={() => addNote('')} className="chalk-btn bg-green-600/80 hover:bg-green-500 py-1.5 px-3 text-sm flex items-center gap-1 shadow-lg font-bold">
                      <Plus className="w-4 h-4" /> 新增便利貼
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap overflow-y-auto custom-scrollbar flex-1 content-start -mx-2 px-2">
                  {bulletinNotes.length === 0 ? (
                    <div className="w-full text-center text-white/30 italic py-8 font-bold mt-4">目前公布欄空空如也，點擊右上角新增便利貼！</div>
                  ) : (
                    bulletinNotes.map((note, index) => (
                      <div 
                        key={note.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`${note.color} w-[180px] h-[180px] rounded shadow-xl p-4 flex flex-col relative group transform transition-transform hover:scale-105 hover:-rotate-2 rotate-1 m-2 cursor-move z-0 hover:z-10`}
                      >
                        <button 
                          onClick={() => setConfirmDeleteNoteId(note.id)} 
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-20"
                          title="撕下便利貼"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <textarea 
                          value={note.text}
                          onChange={(e) => updateNote(note.id, e.target.value)}
                          onBlur={blurNote}
                          className="w-full flex-1 bg-transparent resize-none outline-none font-bold placeholder:text-black/30 text-lg leading-relaxed"
                          placeholder="輸入公布事項..."
                        />
                        <div className="text-xs text-black/40 text-right mt-2 font-bold">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 標題列下放 (本週主題 + 匯出鈕) */}
          <div className="flex flex-col md:flex-row justify-between items-end border-b-2 border-white/30 pb-4 mb-2 mt-4 px-2">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-600/30 border-2 border-yellow-400 text-yellow-300 px-6 py-2 rounded-xl shadow-lg flex items-center">
                <span className="text-sm font-bold opacity-80 mr-3">🎯 本週教學主題</span>
                <span className="text-2xl font-bold tracking-wider">{displayTheme}</span>
              </div>
              <button 
                onClick={() => setThemeInputModal({ isOpen: true, text: displayTheme })}
                className="chalk-btn bg-blue-600/80 hover:bg-blue-500 px-3 py-2 text-sm flex items-center gap-1 font-bold shadow-lg h-full"
              >
                <PenTool className="w-4 h-4" /> 編輯
              </button>
            </div>
            <button onClick={exportToWord} className="chalk-btn bg-blue-600/80 hover:bg-blue-500 shadow-lg flex items-center gap-2 py-3 px-6 text-lg mt-4 md:mt-0">
              <FileText className="w-6 h-6" />
              匯出本週記錄 (Word)
            </button>
          </div>

          {/* 每日日誌區塊 */}
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
                <div key={dateStr} className={`chalk-box flex flex-col ${isToday ? 'border-4 border-yellow-400 bg-yellow-600/20 shadow-2xl' : ''}`}>
                  <div className="text-center font-bold text-lg border-b border-white/20 pb-4 mb-4 flex flex-col items-center">
                    <div className="flex gap-2 items-center">
                      <div className={isToday ? 'text-yellow-300' : 'text-white'}>{dayNames[idx]}</div>
                      <div className={`text-xl ${isToday ? 'text-yellow-300' : 'text-white'}`}>{dateStr.substring(5).replace('-', '/')}</div>
                    </div>
                    <div className="text-sm bg-black/40 rounded-lg p-2 mt-3 font-bold text-yellow-300 border-2 border-white/20 shadow-inner w-full">
                       在籍: <span className="text-white">{enrolledCount}</span> 人 | 出席: <span className="text-green-400">{pCount}</span> 人 | 請假: <span className="text-red-400">{lCount}</span> 人
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
                        placeholder="如: 晴朗" 
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
        </>
      )}
    </div>
  );
}
