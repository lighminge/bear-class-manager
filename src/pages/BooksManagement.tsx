import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, BookMarked, CheckSquare, PlusCircle, PenTool, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Book {
  id: string;
  bookNo: string;
  title: string;
  author: string;
  isBorrowed: string;
  borrower: string;
  borrowDate: string;
  returnDate: string;
}

export default function BooksManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'auto'>('list');
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [bookNo, setBookNo] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isBorrowed, setIsBorrowed] = useState('否');
  const [borrower, setBorrower] = useState('');
  const [borrowDate, setBorrowDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bear_books'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Book));
      setBooks(data);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setEditId(null);
    setBookNo('');
    setTitle('');
    setAuthor('');
    setIsBorrowed('否');
    setBorrower('');
    setBorrowDate('');
    setReturnDate('');
  };

  const handleEdit = (b: Book) => {
    setEditId(b.id);
    setBookNo(b.bookNo);
    setTitle(b.title);
    setAuthor(b.author || '');
    setIsBorrowed(b.isBorrowed || '否');
    setBorrower(b.borrower || '');
    setBorrowDate(b.borrowDate || '');
    setReturnDate(b.returnDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { bookNo, title, author, isBorrowed, borrower, borrowDate, returnDate };
    try {
      if (editId) {
        await updateDoc(doc(db, 'bear_books', editId), data);
      } else {
        await addDoc(collection(db, 'bear_books'), data);
      }
      resetForm();
    } catch (error) {
      console.error(error);
      alert("儲存失敗");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("確定刪除此藏書？")) {
      await deleteDoc(doc(db, 'bear_books', id));
    }
  };

  const handleReturn = async (id: string) => {
    await updateDoc(doc(db, 'bear_books', id), { isBorrowed: '否', borrower: '', borrowDate: '', returnDate: '' });
  };

  const sortedBooks = [...books].sort((a, b) => a.bookNo.localeCompare(b.bookNo, undefined, { numeric: true }));

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('list')} 
          className={`chalk-btn ${activeTab === 'list' ? 'bg-white/30' : ''}`}
        >
          <BookMarked /> 藏書清單與借閱
        </button>
        <button 
          onClick={() => setActiveTab('auto')} 
          className={`chalk-btn ${activeTab === 'auto' ? 'bg-white/30' : ''}`}
        >
          <CheckSquare /> 藏書租借自動安排
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-8">
          {/* Form */}
          <motion.div layout className={`chalk-box ${editId ? 'border-4 border-yellow-400 bg-yellow-600/30' : ''}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <PlusCircle /> {editId ? '修改藏書 / 借閱紀錄' : '新增藏書 / 借閱紀錄'}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input required type="text" placeholder="書籍編號 (如: 01, A-01)" value={bookNo} onChange={e => setBookNo(e.target.value)} className="chalk-input font-bold text-yellow-100" />
              <input required type="text" placeholder="書名" value={title} onChange={e => setTitle(e.target.value)} className="chalk-input" />
              <input type="text" placeholder="作者" value={author} onChange={e => setAuthor(e.target.value)} className="chalk-input" />
              <select value={isBorrowed} onChange={e => setIsBorrowed(e.target.value)} className="chalk-input text-black bg-white">
                <option value="否">是否借出：否</option>
                <option value="是">是否借出：是</option>
              </select>
              
              {isBorrowed === '是' && (
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                  <input type="text" placeholder="借出人員" value={borrower} onChange={e => setBorrower(e.target.value)} className="chalk-input" required />
                  <input type="text" placeholder="借出日或週次 (如: 第1週)" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="chalk-input" required />
                  <input type="date" title="預計還書日期" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="chalk-input" />
                </div>
              )}
              
              <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                {editId && <button type="button" onClick={resetForm} className="chalk-btn">取消</button>}
                <button type="submit" className="chalk-btn bg-yellow-600/50">儲存書籍</button>
              </div>
            </form>
          </motion.div>

          {/* Table */}
          <div className="chalk-box overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <BookOpen /> 藏書清單
              <span className="text-sm font-normal bg-black/30 px-4 py-2 rounded-full shadow-inner ml-4">
                總館藏: <span className="font-bold text-yellow-300">{books.length}</span> 本 | 
                已借出: <span className="text-red-300">{books.filter(b => b.isBorrowed === '是').length}</span> | 
                在館內: <span className="text-green-300">{books.filter(b => b.isBorrowed !== '是').length}</span>
              </span>
            </h2>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-white/50">
                  <th className="p-2 w-20 text-center text-yellow-100">編號</th>
                  <th className="p-2">書名</th>
                  <th className="p-2 w-32">作者</th>
                  <th className="p-2 w-24">狀態</th>
                  <th className="p-2 w-32">借閱人</th>
                  <th className="p-2 w-32">借出日</th>
                  <th className="p-2 w-32 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sortedBooks.map(b => (
                    <motion.tr key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="border-b border-white/20 hover:bg-white/10">
                      <td className="p-2 text-center font-bold text-yellow-200">{b.bookNo}</td>
                      <td className="p-2 font-bold">{b.title}</td>
                      <td className="p-2 text-sm text-gray-300">{b.author}</td>
                      <td className={`p-2 font-bold ${b.isBorrowed === '是' ? 'text-red-400' : 'text-green-400'}`}>
                        {b.isBorrowed === '是' ? '已借出' : '在館內'}
                      </td>
                      <td className="p-2">{b.borrower}</td>
                      <td className="p-2">{b.borrowDate}</td>
                      <td className="p-2 flex flex-wrap justify-center gap-2">
                        {b.isBorrowed === '是' && (
                          <button onClick={() => handleReturn(b.id)} className="text-xs bg-green-600/70 hover:bg-green-500 px-2 py-1 rounded">
                            歸還
                          </button>
                        )}
                        <button onClick={() => handleEdit(b)} className="text-yellow-300"><PenTool className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(b.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'auto' && (
        <div className="chalk-box text-center py-12">
          <p className="text-yellow-100 text-lg">自動安排功能尚在移植中...</p>
        </div>
      )}
    </div>
  );
}
