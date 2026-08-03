import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserCheck, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { collection } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';

export default function TeacherLeaves() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<Record<string, string>>({}); // { '2024-09-02': 'teacherA' }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [colors, setColors] = useState<Record<string, { bg: string; text: string }>>({});
  
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db, 'bear_teachers'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
      setTeachers(data);
      if (data.length > 0 && !selectedTeacher) {
        setSelectedTeacher(data[0].name);
      }
      
      const presetColors = [
        { bg: 'bg-purple-600 border-purple-400', text: 'text-purple-300' },
        { bg: 'bg-blue-600 border-blue-400', text: 'text-blue-300' },
        { bg: 'bg-pink-600 border-pink-400', text: 'text-pink-300' },
        { bg: 'bg-teal-600 border-teal-400', text: 'text-teal-300' }
      ];
      const newColors: Record<string, { bg: string; text: string }> = {};
      data.forEach((t, i) => {
        newColors[t.name] = presetColors[i % presetColors.length];
      });
      setColors(newColors);
    });

    const unsubLeaves = onSnapshot(doc(db, 'bear_teacherLeaves', 'all'), (snap) => {
      if (snap.exists()) {
        setLeaves(snap.data().records || {});
      } else {
        setLeaves({});
      }
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubLeaves();
    };
  }, []);

  const toggleLeave = (dateStr: string) => {
    setLeaves(prev => {
      const next = { ...prev };
      if (next[dateStr] === selectedTeacher) {
        delete next[dateStr];
      } else {
        next[dateStr] = selectedTeacher;
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'bear_teacherLeaves', 'all'), { records: leaves });
      setAlertMessage('請假紀錄已儲存！');
      setShowAlert(true);
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const navMonth = (dir: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const today = new Date();

  return (
    <div className="p-4 h-full flex flex-col bg-[#2b5b3f]/95 text-white relative">
      <ConfirmModal 
        isOpen={showAlert}
        type="alert"
        title="儲存成功"
        message={alertMessage}
        onConfirm={() => setShowAlert(false)}
        onCancel={() => setShowAlert(false)}
      />
      <div className="flex items-center gap-3 mb-4 border-b border-white/20 pb-4">
        <UserCheck className="w-6 h-6 text-yellow-300" />
        <h2 className="text-xl font-bold tracking-wider">老師請假管理</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {teachers.map(t => (
          <button 
            key={t.id}
            onClick={() => setSelectedTeacher(t.name)}
            className={`flex-1 py-1 px-2 rounded border-2 font-bold whitespace-nowrap ${selectedTeacher === t.name ? (colors[t.name]?.bg || 'bg-yellow-600 border-yellow-400') : 'bg-transparent border-white/20 text-white/50'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-2">
        <button onClick={() => navMonth(-1)} className="hover:bg-white/20 p-1 rounded"><ChevronLeft className="w-5 h-5" /></button>
        <div className="font-bold">{year}年 {month + 1}月</div>
        <button onClick={() => navMonth(1)} className="hover:bg-white/20 p-1 rounded"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="font-bold text-yellow-200 py-1">{d}</div>
            ))}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const isT = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              const teacherOnLeave = leaves[dateStr];
              
              let bg = 'bg-black/20 hover:bg-white/20';
              if (teacherOnLeave && colors[teacherOnLeave]) {
                bg = `${colors[teacherOnLeave].bg} border-2 font-bold`;
              } else if (teacherOnLeave) {
                bg = 'bg-gray-600 border-gray-400 border-2 font-bold';
              } else if (isT) {
                bg = 'bg-black/20 border-yellow-500 border-2 text-yellow-300 font-bold';
              }

              return (
                <button
                  key={d}
                  onClick={() => toggleLeave(dateStr)}
                  className={`aspect-square rounded ${bg} flex flex-col items-center justify-center transition-colors text-xs`}
                >
                  <span>{d}</span>
                  {teacherOnLeave && <span className="text-[10px] scale-75">{teacherOnLeave[0]}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/20">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="chalk-btn w-full justify-center bg-yellow-600/70 hover:bg-yellow-500"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          儲存請假紀錄
        </button>
      </div>
    </div>
  );
}
