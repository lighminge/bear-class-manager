import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, PlusCircle, PenTool, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Student {
  id: string;
  academicYear: string;
  seatNo: string;
  name: string;
  gender: string;
  status: string;
  allergens: string;
  emergencyContact: string;
  emergencyPhone: string;
}

export default function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filterYear, setFilterYear] = useState('114');
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [academicYear, setAcademicYear] = useState('114');
  const [seatNo, setSeatNo] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('男');
  const [status, setStatus] = useState('在學');
  const [allergens, setAllergens] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bear_students'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(data);
    }, (error) => {
      console.error("Firebase Error:", error);
      alert("讀取學生資料失敗，請確認資料庫權限");
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setAcademicYear('114');
    setSeatNo('');
    setName('');
    setGender('男');
    setStatus('在學');
    setAllergens('');
    setEmergencyContact('');
    setEmergencyPhone('');
  };

  const handleEdit = (s: Student) => {
    setEditId(s.id);
    setAcademicYear(s.academicYear || '114');
    setSeatNo(s.seatNo);
    setName(s.name);
    setGender(s.gender);
    setStatus(s.status || '在學');
    setAllergens(s.allergens || '');
    setEmergencyContact(s.emergencyContact || '');
    setEmergencyPhone(s.emergencyPhone || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDuplicate = students.some(s => 
      s.academicYear === academicYear && String(s.seatNo) === String(seatNo) && s.id !== editId
    );

    if (isDuplicate) {
      alert(`⚠️ 儲存失敗！\n${academicYear}學年度已經有「座號 ${seatNo}」的學生了，座號不可重複。`);
      return;
    }

    const data = {
      academicYear, seatNo, name, gender, status,
      allergens, emergencyContact, emergencyPhone
    };

    try {
      if (editId) {
        await updateDoc(doc(db, 'bear_students', editId), data);
      } else {
        await addDoc(collection(db, 'bear_students'), data);
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert("儲存失敗！");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("確定要刪除這筆學生資料嗎？")) {
      try {
        await deleteDoc(doc(db, 'bear_students', id));
      } catch (error) {
        console.error(error);
        alert("刪除失敗！");
      }
    }
  };

  // Filtered Students
  const displayStudents = students
    .filter(s => filterYear === 'ALL' || s.academicYear === filterYear)
    .sort((a, b) => Number(a.seatNo) - Number(b.seatNo));

  const boys = displayStudents.filter(s => s.gender === '男').length;
  const girls = displayStudents.filter(s => s.gender === '女').length;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Form Section */}
      <motion.div 
        layout
        className={`chalk-box transition-all duration-500 ${editId ? 'border-4 border-yellow-400 bg-yellow-600/30 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : ''}`}
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          {editId ? <PenTool /> : <PlusCircle />} 
          {editId ? '修改學生資料' : '新增學生資料'}
          {editId && <span className="text-sm font-normal text-yellow-200 ml-2 border border-yellow-400 px-2 rounded bg-black/30">(編輯模式)</span>}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select required value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="chalk-input text-black bg-white">
            {['112', '113', '114', '115', '116', '117', '118'].map(y => (
              <option key={y} value={y}>{y}學年</option>
            ))}
          </select>
          <input required type="number" placeholder="座號" value={seatNo} onChange={e => setSeatNo(e.target.value)} className="chalk-input" />
          <input required type="text" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} className="chalk-input" />
          <select value={gender} onChange={e => setGender(e.target.value)} className="chalk-input text-black bg-white">
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="chalk-input text-black bg-white">
            <option value="在學">狀態：在學</option>
            <option value="休學">狀態：休學</option>
            <option value="轉出">狀態：轉出</option>
            <option value="畢業">狀態：畢業</option>
          </select>
          <input type="text" placeholder="過敏原 (無則免填)" value={allergens} onChange={e => setAllergens(e.target.value)} className="chalk-input" />
          <input type="text" placeholder="緊急聯絡人 (非必填)" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="chalk-input" />
          <input type="text" placeholder="緊急聯絡電話 (非必填)" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} className="chalk-input" />
          <div className="md:col-span-3 flex justify-end gap-2 mt-2">
            {editId && <button type="button" onClick={resetForm} className="chalk-btn hover:text-yellow-300">取消</button>}
            <button type="submit" className="chalk-btn bg-yellow-600/50">儲存資料</button>
          </div>
        </form>
      </motion.div>

      {/* List Section */}
      <div className="chalk-box overflow-x-auto custom-scrollbar">
        <h2 className="text-2xl font-bold mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Users /> 班級學生名單
            <span className="text-sm font-normal bg-black/30 px-3 py-1.5 rounded-full border border-white/20 shadow-inner tracking-wide">
               總計: <span className="font-bold text-yellow-300 text-lg">{displayStudents.length}</span> 人 
               <span className="text-white/50 mx-2">|</span> 
               男: <span className="font-bold text-blue-300">{boys}</span> 人
               <span className="text-white/50 mx-2">|</span> 
               女: <span className="font-bold text-red-300">{girls}</span> 人
             </span>
          </div>
          <div className="flex items-center gap-2 text-sm font-normal">
            <label className="text-yellow-100">篩選學年：</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="chalk-input text-black bg-white py-1 rounded">
              <option value="ALL">全部學年</option>
              {Array.from(new Set(students.map(s => s.academicYear))).filter(Boolean).sort().map(y => (
                <option key={y} value={y}>{y}學年</option>
              ))}
            </select>
          </div>
        </h2>
        
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b-2 border-white/50">
              <th className="p-2">就讀學年</th>
              <th className="p-2">座號</th>
              <th className="p-2">姓名</th>
              <th className="p-2">性別</th>
              <th className="p-2 w-20">狀態</th>
              <th className="p-2 text-red-200">過敏原</th>
              <th className="p-2">聯絡人</th>
              <th className="p-2">聯絡電話</th>
              <th className="p-2 text-center w-24">操作</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {displayStudents.map(s => {
                const isEnrolled = (!s.status || s.status === '在學');
                return (
                  <motion.tr 
                    key={s.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`border-b border-white/20 hover:bg-white/10 ${!isEnrolled ? 'opacity-50' : ''}`}
                  >
                    <td className="p-2 font-bold text-yellow-300">{s.academicYear || '-'}</td>
                    <td className="p-2">{s.seatNo}</td>
                    <td className="p-2 font-bold">{s.name}</td>
                    <td className="p-2">{s.gender}</td>
                    <td className={`p-2 font-bold ${isEnrolled ? 'text-green-300' : 'text-gray-400'}`}>{s.status || '在學'}</td>
                    <td className="p-2 text-red-200">{s.allergens || '無'}</td>
                    <td className="p-2">{s.emergencyContact || '-'}</td>
                    <td className="p-2">{s.emergencyPhone || '-'}</td>
                    <td className="p-2 flex justify-center gap-2">
                      <button onClick={() => handleEdit(s)} className="text-yellow-300 hover:scale-110 transition-transform"><PenTool className="w-5 h-5" /></button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:scale-110 transition-transform"><Trash2 className="w-5 h-5" /></button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
