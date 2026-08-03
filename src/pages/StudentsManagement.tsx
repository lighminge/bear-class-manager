import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, PlusCircle, PenTool, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ConfirmModal';

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

// Pagination Component
function Pagination({ total, current, pageSize, onPageChange, onPageSizeChange }: any) {
  const pages = Math.ceil(total / pageSize);
  if (pages === 0) return null;
  return (
    <div className="flex justify-between items-center bg-black/20 p-2 rounded">
      <div className="flex gap-2">
        <button onClick={() => onPageChange(1)} disabled={current === 1} className="chalk-btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50">第一頁</button>
        <button onClick={() => onPageChange(current - 1)} disabled={current === 1} className="chalk-btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50">上一頁</button>
      </div>
      <div className="flex gap-4 items-center text-sm font-bold text-yellow-200">
        <span>第 {current} / {pages} 頁</span>
        <select value={pageSize} onChange={e => { onPageSizeChange(Number(e.target.value)); onPageChange(1); }} className="chalk-input bg-black/50 py-1 text-xs text-white">
          <option value={5}>5 筆 / 頁</option>
          <option value={10}>10 筆 / 頁</option>
          <option value={15}>15 筆 / 頁</option>
          <option value={20}>20 筆 / 頁</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onPageChange(current + 1)} disabled={current === pages} className="chalk-btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50">下一頁</button>
        <button onClick={() => onPageChange(pages)} disabled={current === pages} className="chalk-btn py-1 px-3 text-xs bg-white/10 hover:bg-white/20 disabled:opacity-50">最後頁</button>
      </div>
    </div>
  );
}

export default function StudentsManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  
  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterStatus, setFilterStatus] = useState('在學');
  
  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [academicYear, setAcademicYear] = useState('');
  const [seatNo, setSeatNo] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('男');
  const [status, setStatus] = useState('在學');
  const [allergens, setAllergens] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Pagination & Confirm
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bear_students'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(data);
    }, (error) => {
      console.error("Firebase Error:", error);
      alert("讀取學生資料失敗，請確認資料庫權限");
    });
    
    const unsubSettings = onSnapshot(doc(db, 'bear_settings', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setFilterYear(prev => prev === '' ? (data.academicYear || '114') : prev);
        setAcademicYear(prev => prev === '' ? (data.academicYear || '114') : prev);
      }
    });

    return () => { unsubscribe(); unsubSettings(); };
  }, []);

  // 當過濾條件改變時，重設分頁到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [filterYear, filterName, filterStatus]);

  const resetForm = () => {
    setEditId(null);
    setSeatNo('');
    setName('');
    setGender('男');
    setStatus('在學');
    setAllergens('');
    setEmergencyContact('');
    setEmergencyPhone('');
    // 不重置 academicYear，保持目前的預設值
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
    setIsModalOpen(true);
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
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("儲存失敗！");
    }
  };

  const handleDelete = async () => {
    if (confirmDeleteId) {
      try {
        await deleteDoc(doc(db, 'bear_students', confirmDeleteId));
        setConfirmDeleteId(null);
      } catch (error) {
        console.error(error);
        alert("刪除失敗！");
      }
    }
  };

  const [confirmGlobalYearOpen, setConfirmGlobalYearOpen] = useState(false);

  const handleSetGlobalYear = async () => {
    if (filterYear === 'ALL' || !filterYear) {
      alert('請先選擇一個特定的學年，再設為系統預設！');
      return;
    }
    setConfirmGlobalYearOpen(true);
  };

  const executeSetGlobalYear = async () => {
    try {
      await setDoc(doc(db, 'bear_settings', 'main'), { academicYear: filterYear }, { merge: true });
      alert(`設定成功！目前系統預設學年已更新為：${filterYear} 學年`);
    } catch (e) {
      console.error(e);
      alert('設定失敗');
    } finally {
      setConfirmGlobalYearOpen(false);
    }
  };

  // Filtered Students
  const displayStudents = students
    .filter(s => filterYear === 'ALL' || s.academicYear === filterYear)
    .filter(s => filterStatus === 'ALL' || (s.status || '在學') === filterStatus)
    .filter(s => !filterName || s.name.includes(filterName))
    .sort((a, b) => Number(a.seatNo) - Number(b.seatNo));

  const boys = displayStudents.filter(s => s.gender === '男').length;
  const girls = displayStudents.filter(s => s.gender === '女').length;

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedStudents = displayStudents.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <ConfirmModal 
        isOpen={!!confirmDeleteId}
        type="confirm"
        title="確認刪除"
        message="確定要刪除這筆學生資料嗎？此動作無法復原。"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
      <ConfirmModal 
        isOpen={confirmGlobalYearOpen}
        type="confirm"
        title="設為系統預設學年"
        message={`確定要將系統的「全域預設學年」設定為 ${filterYear} 學年嗎？\n這會連動改變點名簿、藏書借閱等其他工具的預設學年。`}
        onConfirm={executeSetGlobalYear}
        onCancel={() => setConfirmGlobalYearOpen(false)}
      />

      {/* Filter Section */}
      <div className="chalk-box flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-yellow-200 text-sm mb-1">目前所在學年</label>
            <div className="flex gap-2">
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="chalk-input text-black bg-white w-32 font-bold">
                <option value="ALL">全部學年</option>
                {['112', '113', '114', '115', '116', '117', '118'].map(y => (
                  <option key={y} value={y}>{y}學年</option>
                ))}
              </select>
              <button 
                onClick={handleSetGlobalYear}
                title="將此學年設為系統預設"
                className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 py-1 px-3 text-sm shadow font-bold"
              >
                設為系統預設
              </button>
            </div>
          </div>
          <div>
            <label className="block text-yellow-200 text-sm mb-1">學生姓名</label>
            <input 
              type="text" 
              placeholder="搜尋姓名..." 
              value={filterName} 
              onChange={e => setFilterName(e.target.value)} 
              className="chalk-input text-black bg-white w-40"
            />
          </div>
          <div>
            <label className="block text-yellow-200 text-sm mb-1">狀態</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="chalk-input text-black bg-white w-32">
              <option value="ALL">全部狀態</option>
              <option value="在學">在學</option>
              <option value="休學">休學</option>
              <option value="轉出">轉出</option>
              <option value="畢業">畢業</option>
            </select>
          </div>
        </div>
        
        <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="chalk-btn bg-green-600 hover:bg-green-500 flex items-center gap-2 shadow-lg">
          <PlusCircle className="w-5 h-5" /> 新增學生
        </button>
      </div>

      {/* Edit/Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="chalk-box max-w-2xl w-full relative bg-[#2b5b3f]"
            >
              <h2 className="text-2xl font-bold mb-6 text-yellow-300 flex items-center gap-2">
                {editId ? <PenTool /> : <PlusCircle />} 
                {editId ? '修改學生資料' : '新增學生資料'}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">學年度 *</label>
                  <select required value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="chalk-input text-black bg-white w-full">
                    {['112', '113', '114', '115', '116', '117', '118'].map(y => (
                      <option key={y} value={y}>{y}學年</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">座號 *</label>
                  <input required type="number" placeholder="座號" value={seatNo} onChange={e => setSeatNo(e.target.value)} className="chalk-input w-full text-black bg-white" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">姓名 *</label>
                  <input required type="text" placeholder="姓名" value={name} onChange={e => setName(e.target.value)} className="chalk-input w-full text-black bg-white" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">性別 *</label>
                  <select value={gender} onChange={e => setGender(e.target.value)} className="chalk-input text-black bg-white w-full">
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">狀態 *</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="chalk-input text-black bg-white w-full">
                    <option value="在學">在學</option>
                    <option value="休學">休學</option>
                    <option value="轉出">轉出</option>
                    <option value="畢業">畢業</option>
                  </select>
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">過敏原</label>
                  <input type="text" placeholder="過敏原 (無則免填)" value={allergens} onChange={e => setAllergens(e.target.value)} className="chalk-input w-full text-black bg-white" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">緊急聯絡人</label>
                  <input type="text" placeholder="緊急聯絡人 (非必填)" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} className="chalk-input w-full text-black bg-white" />
                </div>
                <div>
                  <label className="block text-yellow-200 text-sm mb-1">緊急聯絡電話</label>
                  <input type="text" placeholder="聯絡電話 (非必填)" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} className="chalk-input w-full text-black bg-white" />
                </div>
                <div className="md:col-span-2 flex justify-end gap-3 mt-6 pt-4 border-t border-white/20">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="chalk-btn bg-black/20 text-white hover:bg-black/40">取消</button>
                  <button type="submit" className="chalk-btn bg-yellow-600/80 hover:bg-yellow-500 font-bold px-6 shadow-lg">儲存資料</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* List Section */}
      <div className="chalk-box overflow-x-auto custom-scrollbar flex flex-col gap-4">
        <h2 className="text-2xl font-bold flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="w-6 h-6 text-yellow-300" /> 學生名單
            <span className="text-sm font-normal bg-black/30 px-3 py-1.5 rounded-full border border-white/20 shadow-inner tracking-wide ml-2">
               找到: <span className="font-bold text-yellow-300 text-lg">{displayStudents.length}</span> 人 
               <span className="text-white/50 mx-2">|</span> 
               男: <span className="font-bold text-blue-300">{boys}</span> 
               <span className="text-white/50 mx-2">|</span> 
               女: <span className="font-bold text-red-300">{girls}</span>
             </span>
          </div>
        </h2>
        
        {displayStudents.length > 0 && (
          <Pagination 
            total={displayStudents.length} 
            current={currentPage} 
            pageSize={pageSize} 
            onPageChange={setCurrentPage} 
            onPageSizeChange={setPageSize} 
          />
        )}
        
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b-2 border-white/50 bg-black/20">
              <th className="p-3 text-center w-24">操作</th>
              <th className="p-3">學年</th>
              <th className="p-3">座號</th>
              <th className="p-3">姓名</th>
              <th className="p-3">性別</th>
              <th className="p-3 w-20">狀態</th>
              <th className="p-3 text-red-200">過敏原</th>
              <th className="p-3">聯絡人</th>
              <th className="p-3">聯絡電話</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-white/50">找不到符合條件的學生資料</td>
                </tr>
              ) : (
                paginatedStudents.map(s => {
                  const isEnrolled = (!s.status || s.status === '在學');
                  return (
                    <motion.tr 
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-white/20 hover:bg-white/10 transition-colors ${!isEnrolled ? 'opacity-50 hover:opacity-80' : ''}`}
                    >
                      <td className="p-3 flex justify-center gap-2">
                        <button onClick={() => handleEdit(s)} className="p-2 hover:bg-blue-500/50 rounded-full transition-colors group">
                          <PenTool className="w-4 h-4 text-blue-300 group-hover:text-white" />
                        </button>
                        <button onClick={() => setConfirmDeleteId(s.id)} className="p-2 hover:bg-red-500/50 rounded-full transition-colors group">
                          <Trash2 className="w-4 h-4 text-red-300 group-hover:text-white" />
                        </button>
                      </td>
                      <td className="p-3 font-bold text-yellow-300">{s.academicYear || '-'}</td>
                      <td className="p-3">{s.seatNo}</td>
                      <td className="p-3 font-bold">{s.name}</td>
                      <td className="p-3">{s.gender}</td>
                      <td className={`p-3 font-bold ${isEnrolled ? 'text-green-300' : 'text-gray-400'}`}>{s.status || '在學'}</td>
                      <td className="p-3 text-red-300 font-bold">{s.allergens || '-'}</td>
                      <td className="p-3">{s.emergencyContact || '-'}</td>
                      <td className="p-3">{s.emergencyPhone || '-'}</td>
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>

        {displayStudents.length > 0 && (
          <Pagination 
            total={displayStudents.length} 
            current={currentPage} 
            pageSize={pageSize} 
            onPageChange={setCurrentPage} 
            onPageSizeChange={setPageSize} 
          />
        )}
      </div>
    </div>
  );
}
