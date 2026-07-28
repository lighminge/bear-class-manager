import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserCheck, PlusCircle, PenTool, Trash2, Save, Loader2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

interface Teacher {
  id: string;
  name: string;
  title: string;
  phone: string;
  email: string;
}

export default function TeachersManagement() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', title: '', phone: '', email: '' });

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmType, setConfirmType] = useState<'confirm' | 'alert'>('confirm');
  const [confirmTitle, setConfirmTitle] = useState('確認');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});

  // 輪調設定
  const [rotationSettings, setRotationSettings] = useState({ teacherA: '', teacherB: '', firstWeekLead: '' });
  const [savingRotation, setSavingRotation] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bear_teachers'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Teacher));
      setTeachers(data);
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'bear_settings', 'main'), (snap) => {
      if (snap.exists() && snap.data().teachersRotation) {
        setRotationSettings(snap.data().teachersRotation);
      }
    });

    return () => {
      unsub();
      unsubSettings();
    };
  }, []);

  const openAddModal = () => {
    setEditId(null);
    setFormData({ name: '', title: '', phone: '', email: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditId(t.id);
    setFormData({ name: t.name, title: t.title || '', phone: t.phone || '', email: t.email || '' });
    setIsModalOpen(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return alert('請填寫教師姓名');
    try {
      if (editId) {
        await updateDoc(doc(db, 'bear_teachers', editId), formData);
      } else {
        await addDoc(collection(db, 'bear_teachers'), formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('儲存失敗');
    }
  };

  const requestDelete = (id: string, name: string) => {
    setConfirmType('confirm');
    setConfirmTitle('確認刪除');
    setConfirmMessage(`確定要刪除教師「${name}」的資料嗎？`);
    setConfirmAction(() => async () => {
      await deleteDoc(doc(db, 'bear_teachers', id));
      setShowConfirm(false);
    });
    setShowConfirm(true);
  };

  const handleSaveRotation = async () => {
    if (!rotationSettings.teacherA || !rotationSettings.teacherB || !rotationSettings.firstWeekLead) {
      return alert('請完整設定參與輪調的兩位老師與第一週主教！');
    }
    setSavingRotation(true);
    try {
      await setDoc(doc(db, 'bear_settings', 'main'), { teachersRotation: rotationSettings }, { merge: true });
      setConfirmType('alert');
      setConfirmTitle('儲存成功');
      setConfirmMessage('輪調設定已儲存！每週排程行事曆將會自動切換主教與協同老師。');
      setConfirmAction(() => () => setShowConfirm(false));
      setShowConfirm(true);
    } catch (err) {
      alert('儲存失敗');
    } finally {
      setSavingRotation(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-12 h-12 text-yellow-500 animate-spin" /></div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in space-y-8">
      <ConfirmModal 
        isOpen={showConfirm}
        type={confirmType}
        title={confirmTitle}
        message={confirmMessage}
        onConfirm={confirmAction}
        onCancel={() => setShowConfirm(false)}
      />

      <div className="flex items-center gap-4 mb-8">
        <div className="bg-yellow-500 p-3 rounded-full shadow-lg shadow-yellow-500/20">
          <UserCheck className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-4xl font-bold tracking-wider drop-shadow-md">教師專區</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左側：輪調設定 */}
        <div className="chalk-box lg:col-span-1 h-fit">
          <h2 className="text-xl font-bold mb-6 text-yellow-300 flex items-center gap-2">
            主 / 協同老師自動輪調設定
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-yellow-200 text-sm mb-1">參與輪調教師 A</label>
              <select 
                value={rotationSettings.teacherA} 
                onChange={e => setRotationSettings(prev => ({ ...prev, teacherA: e.target.value, firstWeekLead: prev.firstWeekLead === prev.teacherB ? prev.teacherB : e.target.value }))}
                className="chalk-input w-full bg-black/50 text-white"
              >
                <option value="">請選擇</option>
                {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-yellow-200 text-sm mb-1">參與輪調教師 B</label>
              <select 
                value={rotationSettings.teacherB} 
                onChange={e => setRotationSettings(prev => ({ ...prev, teacherB: e.target.value }))}
                className="chalk-input w-full bg-black/50 text-white"
              >
                <option value="">請選擇</option>
                {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div className="pt-4 border-t border-white/20">
              <label className="block text-yellow-200 text-sm mb-1">設定「第一週」的主教老師</label>
              <select 
                value={rotationSettings.firstWeekLead} 
                onChange={e => setRotationSettings(prev => ({ ...prev, firstWeekLead: e.target.value }))}
                className="chalk-input w-full bg-white text-black"
              >
                <option value="">請選擇</option>
                {rotationSettings.teacherA && <option value={rotationSettings.teacherA}>{rotationSettings.teacherA}</option>}
                {rotationSettings.teacherB && <option value={rotationSettings.teacherB}>{rotationSettings.teacherB}</option>}
              </select>
            </div>
            
            <button 
              onClick={handleSaveRotation}
              disabled={savingRotation}
              className="chalk-btn w-full mt-6 bg-yellow-600 hover:bg-yellow-500 flex justify-center items-center gap-2"
            >
              {savingRotation ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              儲存輪調設定
            </button>
            <p className="text-sm text-green-200/70 mt-2 text-center">
              設定完成後，第二週起系統會依單雙數週自動交換主教與協同老師。
            </p>
          </div>
        </div>

        {/* 右側：教師名單 */}
        <div className="chalk-box lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              教師資料清單
              <span className="text-sm font-normal bg-black/30 px-3 py-1 rounded-full">共 {teachers.length} 名</span>
            </h2>
            <button onClick={openAddModal} className="chalk-btn bg-green-600 hover:bg-green-500 flex items-center gap-2 px-6">
              <PlusCircle className="w-5 h-5" /> 新增教師
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-white/50 bg-black/20">
                  <th className="p-3 w-1/4">姓名</th>
                  <th className="p-3 w-1/4">職稱</th>
                  <th className="p-3 w-1/4">聯絡電話</th>
                  <th className="p-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr><td colSpan={4} className="p-6 text-center text-white/50">尚未新增任何教師資料</td></tr>
                ) : (
                  teachers.map(t => (
                    <tr key={t.id} className="border-b border-white/20 hover:bg-white/10 transition-colors">
                      <td className="p-3 font-bold text-yellow-200">{t.name}</td>
                      <td className="p-3">{t.title}</td>
                      <td className="p-3">{t.phone}</td>
                      <td className="p-3">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => openEditModal(t)} className="p-2 hover:bg-blue-500/50 rounded-full transition-colors group">
                            <PenTool className="w-4 h-4 group-hover:text-white text-blue-300" />
                          </button>
                          <button onClick={() => requestDelete(t.id, t.name)} className="p-2 hover:bg-red-500/50 rounded-full transition-colors group">
                            <Trash2 className="w-4 h-4 group-hover:text-white text-red-300" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <form onSubmit={handleSaveTeacher} className="chalk-box max-w-md w-full relative">
            <h2 className="text-2xl font-bold mb-6 text-yellow-300">
              {editId ? '編輯教師資料' : '新增教師'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-yellow-200 text-sm mb-1">姓名 *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="chalk-input w-full bg-white text-black"
                  required
                />
              </div>
              <div>
                <label className="block text-yellow-200 text-sm mb-1">職稱</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="chalk-input w-full bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-yellow-200 text-sm mb-1">聯絡電話</label>
                <input 
                  type="text" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="chalk-input w-full bg-white text-black"
                />
              </div>
              <div>
                <label className="block text-yellow-200 text-sm mb-1">Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="chalk-input w-full bg-white text-black"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setIsModalOpen(false)} className="chalk-btn flex-1 bg-gray-600 hover:bg-gray-500">取消</button>
              <button type="submit" className="chalk-btn flex-1 bg-yellow-600 hover:bg-yellow-500">儲存</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
