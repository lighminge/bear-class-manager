import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, Save, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Attendance() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState('114');

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'bear_students'), (snap) => {
      const studs = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((s: any) => s.academicYear === year && (!s.status || s.status === '在學'))
        .sort((a: any, b: any) => Number(a.seatNo) - Number(b.seatNo));
      setStudents(studs);
    });
    return () => unsubStudents();
  }, [year]);

  useEffect(() => {
    setLoading(true);
    const docId = date.replace(/\//g, '-');
    const unsubAtt = onSnapshot(doc(db, 'bear_attendance', docId), (snap) => {
      if (snap.exists()) {
        setAttendance(snap.data().records || {});
      } else {
        setAttendance({});
      }
      setLoading(false);
    });
    return () => unsubAtt();
  }, [date]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status
      }
    }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        remarks: remark
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const docId = date.replace(/\//g, '-');
    try {
      await setDoc(doc(db, 'bear_attendance', docId), { records: attendance }, { merge: true });
      alert('點名資料已儲存！');
    } catch (e) {
      console.error(e);
      alert('儲存失敗');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'attend', label: '出席', color: 'bg-green-500/20 text-green-300 border-green-500' },
    { value: 'leave', label: '事假', color: 'bg-blue-500/20 text-blue-300 border-blue-500' },
    { value: 'sick', label: '病假', color: 'bg-orange-500/20 text-orange-300 border-orange-500' }
  ];

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const totalStudents = students.length;
  const presentCount = students.filter(s => (attendance[s.id]?.status || 'attend') === 'attend').length;
  const absentCount = students.filter(s => {
    const st = attendance[s.id]?.status;
    return st === 'leave' || st === 'sick';
  }).length;

  return (
    <div className="p-4 h-full flex flex-col bg-[#2b5b3f]/95 text-white">
      <div className="flex items-center gap-3 mb-4 border-b border-white/20 pb-4">
        <Users className="w-6 h-6 text-yellow-300" />
        <h2 className="text-xl font-bold tracking-wider drop-shadow-md">點名簿</h2>
      </div>

      <div className="flex justify-between text-sm mb-4 text-yellow-100 bg-black/20 p-2 rounded">
        <span>應到: <span className="font-bold text-yellow-300 text-lg">{totalStudents}</span></span>
        <span>出席: <span className="font-bold text-green-300 text-lg">{presentCount}</span></span>
        <span>請假: <span className="font-bold text-orange-300 text-lg">{absentCount}</span></span>
      </div>

      <div className="flex gap-2 mb-4 items-center">
        <select value={year} onChange={e => setYear(e.target.value)} className="chalk-input bg-black/50 text-white rounded px-2 py-1 w-24">
          {['112', '113', '114', '115'].map(y => <option key={y} value={y}>{y}學年</option>)}
        </select>
        <button onClick={() => changeDate(-1)} className="p-1 hover:bg-white/20 rounded"><ChevronLeft className="w-5 h-5" /></button>
        <input 
          type="date" 
          value={date} 
          onChange={e => setDate(e.target.value)} 
          className="chalk-input flex-1 bg-white text-black rounded px-2 py-1 text-center font-bold"
        />
        <button onClick={() => changeDate(1)} className="p-1 hover:bg-white/20 rounded"><ChevronRight className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
        {loading ? (
          <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
        ) : students.length === 0 ? (
          <div className="text-center opacity-50 p-4">查無學生資料</div>
        ) : (
          students.map(s => {
            const currentStatus = attendance[s.id]?.status || 'attend';
            return (
              <div key={s.id} className="bg-black/20 p-3 rounded-lg border border-white/10">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-bold">{s.seatNo}號 {s.name}</div>
                </div>
                <div className="flex gap-1 mb-2">
                  {statusOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(s.id, opt.value)}
                      className={`flex-1 py-1 text-xs rounded border ${currentStatus === opt.value ? opt.color : 'border-white/20 text-white/50 hover:bg-white/5'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  value={attendance[s.id]?.remarks || ''}
                  onChange={e => handleRemarkChange(s.id, e.target.value)}
                  placeholder="備註說明..." 
                  className="chalk-input w-full text-sm bg-white/5 rounded px-2 py-1"
                />
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/20">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="chalk-btn w-full justify-center bg-yellow-600/70 hover:bg-yellow-500"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          儲存點名紀錄
        </button>
      </div>
    </div>
  );
}
