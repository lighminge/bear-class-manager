import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BookOpen, CheckSquare, PlusCircle, PenTool, Trash2, Loader2, Printer, Settings } from 'lucide-react';
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

interface Student {
  id: string;
  seatNo: string;
  name: string;
  academicYear: string;
  status: string;
}

export default function BooksManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
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

  // Auto Arrange State
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [academicYear, setAcademicYear] = useState('114');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('sequential');
  const [arrangementData, setArrangementData] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'student'>('week');

  useEffect(() => {
    const unsubBooks = onSnapshot(collection(db, 'bear_books'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Book));
      setBooks(data);
      // Auto-select all books initially for auto-arrange if set is empty
      setSelectedBooks(prev => prev.size === 0 ? new Set(data.map(b => b.id)) : prev);
    });
    
    const unsubStudents = onSnapshot(collection(db, 'bear_students'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      setStudents(data);
    });

    const unsubArr = onSnapshot(doc(db, 'bear_autoArrangements', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setArrangementData(docSnap.data());
      }
    });

    return () => { unsubBooks(); unsubStudents(); unsubArr(); };
  }, []);

  const resetForm = () => {
    setEditId(null);
    setBookNo(''); setTitle(''); setAuthor(''); setIsBorrowed('否');
    setBorrower(''); setBorrowDate(''); setReturnDate('');
  };

  const handleEdit = (b: Book) => {
    setEditId(b.id);
    setBookNo(b.bookNo); setTitle(b.title); setAuthor(b.author || '');
    setIsBorrowed(b.isBorrowed || '否'); setBorrower(b.borrower || '');
    setBorrowDate(b.borrowDate || ''); setReturnDate(b.returnDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { bookNo, title, author, isBorrowed, borrower, borrowDate, returnDate };
    try {
      if (editId) {
        await updateDoc(doc(db, 'bear_books', editId), data);
        alert('修改成功！');
      } else {
        await addDoc(collection(db, 'bear_books'), data);
        alert('新增成功！');
      }
      resetForm();
    } catch (error) {
      alert('儲存失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除這筆藏書嗎？')) {
      await deleteDoc(doc(db, 'bear_books', id));
    }
  };

  const handleReturn = async (id: string) => {
    await updateDoc(doc(db, 'bear_books', id), { isBorrowed: '否', borrower: '', borrowDate: '', returnDate: '' });
  };

  const toggleBookSelect = (id: string) => {
    const next = new Set(selectedBooks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBooks(next);
  };

  const sortedBooks = [...books].sort((a, b) => String(a.bookNo || '').localeCompare(String(b.bookNo || ''), undefined, {numeric: true, sensitivity: 'base'}));
  
  const generateAutoArrange = async () => {
    const targetStudents = students
      .filter(s => s.academicYear === academicYear && (!s.status || s.status === '在學'))
      .sort((a,b) => Number(a.seatNo) - Number(b.seatNo));
      
    if (targetStudents.length === 0) {
      alert(`找不到【${academicYear}學年度】在學學生！`);
      return;
    }
    if (selectedBooks.size < targetStudents.length) {
      alert(`勾選的書籍數量 (${selectedBooks.size}) 少於學生人數 (${targetStudents.length})，請多選一些書！`);
      return;
    }

    setGenerating(true);
    let targetBooks = [...books]
      .filter(b => selectedBooks.has(b.id))
      .sort((a,b) => String(a.bookNo || '').localeCompare(String(b.bookNo || ''), undefined, {numeric: true, sensitivity: 'base'}));

    if (method === 'reverse') {
      targetBooks.reverse();
    } else if (method === 'random') {
      for (let i = targetBooks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targetBooks[i], targetBooks[j]] = [targetBooks[j], targetBooks[i]];
      }
    }

    const weeks = 21;
    const weeklyArrangements = [];

    for (let w = 0; w < weeks; w++) {
      const weekItems: any[] = [];
      targetStudents.forEach((student, index) => {
        const bookIndex = (index + w) % targetBooks.length;
        const bk = targetBooks[bookIndex];
        weekItems.push({
          student: { id: student.id, seatNo: student.seatNo, name: student.name },
          book: bk ? { id: bk.id, bookNo: bk.bookNo, title: bk.title } : null
        });
      });
      weeklyArrangements.push({ weekIndex: w, items: weekItems });
    }

    try {
      await setDoc(doc(db, 'bear_autoArrangements', 'main'), {
        weeks,
        startDate,
        academicYear,
        method,
        weeklyArrangements
      });
      alert('借閱表產生成功！');
    } catch (err) {
      alert('產生失敗');
    } finally {
      setGenerating(false);
    }
  };

  const getPrintDate = (weekIdx: number) => {
    if (!arrangementData?.startDate) return '';
    const d = new Date(arrangementData.startDate);
    d.setDate(d.getDate() + (weekIdx * 7));
    return `${d.getMonth()+1}/${d.getDate()}`;
  };

  const printAutoArrange = () => {
    const html = `
      <html><head><style>
        body { font-family: sans-serif; padding: 20px; }
        .week-container { margin-bottom: 30px; page-break-inside: avoid; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }
        .item { border: 1px solid #ccc; padding: 10px; border-radius: 5px; }
        @media print { .week-container { page-break-after: always; } }
      </style></head><body>
      <h1>${arrangementData.academicYear}學年度 藏書借閱表</h1>
      ${arrangementData.weeklyArrangements.map((w: any) => `
        <div class="week-container">
          <h2>第 ${w.weekIndex + 1} 週 (借閱日: ${getPrintDate(w.weekIndex)})</h2>
          <div class="grid">
            ${w.items.map((it: any) => `
              <div class="item">
                <strong>${it.student.seatNo}號 ${it.student.name}</strong><br>
                [${it.book?.bookNo || '-'}] ${it.book?.title || '無'}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      </body></html>
    `;
    const w = window.open();
    w?.document.write(html);
    w?.document.close();
    w?.focus();
    setTimeout(() => w?.print(), 500);
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-fade-in space-y-6">
      <div className="flex gap-4 mb-6 border-b-2 border-white/30 pb-4">
        <button onClick={() => setActiveTab('list')} className={`chalk-btn ${activeTab === 'list' ? 'bg-white/30' : ''}`}>
          <BookOpen /> 藏書清單
        </button>
        <button onClick={() => setActiveTab('auto')} className={`chalk-btn ${activeTab === 'auto' ? 'bg-white/30' : ''}`}>
          <CheckSquare /> 藏書租借自動安排
        </button>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-8">
          <motion.div layout className={`chalk-box ${editId ? 'border-4 border-yellow-400 bg-yellow-600/30' : ''}`}>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><PlusCircle /> {editId ? '修改藏書' : '新增藏書'}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input required type="text" placeholder="書籍編號" value={bookNo} onChange={e => setBookNo(e.target.value)} className="chalk-input font-bold text-yellow-100" />
              <input required type="text" placeholder="書名" value={title} onChange={e => setTitle(e.target.value)} className="chalk-input" />
              <input type="text" placeholder="作者" value={author} onChange={e => setAuthor(e.target.value)} className="chalk-input" />
              <select value={isBorrowed} onChange={e => setIsBorrowed(e.target.value)} className="chalk-input text-black bg-white">
                <option value="否">在館內</option>
                <option value="是">已借出</option>
              </select>
              {isBorrowed === '是' && (
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="text" placeholder="借出人員" value={borrower} onChange={e => setBorrower(e.target.value)} className="chalk-input" required />
                  <input type="text" placeholder="借出日" value={borrowDate} onChange={e => setBorrowDate(e.target.value)} className="chalk-input" required />
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} className="chalk-input" />
                </div>
              )}
              <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                {editId && <button type="button" onClick={resetForm} className="chalk-btn">取消</button>}
                <button type="submit" className="chalk-btn bg-yellow-600/50">儲存書籍</button>
              </div>
            </form>
          </motion.div>

          <div className="chalk-box overflow-x-auto">
            <h2 className="text-2xl font-bold mb-4">藏書清單 ({books.length}本)</h2>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b-2 border-white/50"><th className="p-2">編號</th><th className="p-2">書名</th><th className="p-2">作者</th><th className="p-2">狀態</th><th className="p-2">操作</th></tr>
              </thead>
              <tbody>
                {sortedBooks.map(b => (
                  <tr key={b.id} className="border-b border-white/20 hover:bg-white/10">
                    <td className="p-2 font-bold text-yellow-200">{b.bookNo}</td>
                    <td className="p-2">{b.title}</td>
                    <td className="p-2">{b.author}</td>
                    <td className={`p-2 font-bold ${b.isBorrowed === '是' ? 'text-red-400' : 'text-green-400'}`}>{b.isBorrowed === '是' ? '已借出' : '在館內'}</td>
                    <td className="p-2 flex gap-2">
                      {b.isBorrowed === '是' && <button onClick={() => handleReturn(b.id)} className="bg-green-600/70 px-2 py-1 rounded text-xs">歸還</button>}
                      <button onClick={() => handleEdit(b)} className="text-yellow-300"><PenTool className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(b.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'auto' && (
        <div className="space-y-6">
          <div className="chalk-box bg-[#346b4b] border-yellow-400 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Settings className="w-6 h-6" /> 產生借閱表設定</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-yellow-200 mb-2">1. 選擇學年度 (學生)</label>
                <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} className="chalk-input w-full bg-white/10">
                  {['112', '113', '114', '115'].map(y => <option key={y} value={y}>{y}學年</option>)}
                </select>
                <div className="text-xs text-white/50 mt-1">只抓取該學年度「在學」學生</div>
              </div>
              <div>
                <label className="block text-yellow-200 mb-2">2. 設定開始日期 (第1週)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="chalk-input w-full bg-white/10" />
              </div>
              <div>
                <label className="block text-yellow-200 mb-2">3. 分配方式</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="chalk-input w-full bg-white/10">
                  <option value="sequential">依書籍編號順序輪替</option>
                  <option value="random">隨機打亂書單輪替</option>
                  <option value="reverse">依書籍編號反向輪替</option>
                </select>
              </div>
            </div>

            <div className="mb-6 border border-white/20 rounded p-4 h-64 overflow-y-auto custom-scrollbar bg-black/20">
              <label className="block text-yellow-200 mb-2 font-bold">4. 勾選欲參與輪替的書籍 ({selectedBooks.size} / {books.length})</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {sortedBooks.map(b => (
                  <label key={b.id} className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1 rounded">
                    <input type="checkbox" checked={selectedBooks.has(b.id)} onChange={() => toggleBookSelect(b.id)} className="w-4 h-4 accent-yellow-500" />
                    <span className="text-sm truncate">[{b.bookNo}] {b.title}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={generateAutoArrange} disabled={generating} className="chalk-btn w-full justify-center bg-yellow-600 shadow-lg text-lg py-3">
              {generating ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckSquare className="w-6 h-6" />}
              產生 21 週每週借閱表
            </button>
          </div>

          {arrangementData && (
            <div className="chalk-box">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">借閱表結果 ({arrangementData.academicYear}學年)</h2>
                <div className="flex gap-2">
                  <button onClick={() => setViewMode('week')} className={`chalk-btn text-sm ${viewMode === 'week' ? 'bg-yellow-600' : 'bg-black/30'}`}>依週次檢視</button>
                  <button onClick={() => setViewMode('student')} className={`chalk-btn text-sm ${viewMode === 'student' ? 'bg-yellow-600' : 'bg-black/30'}`}>依學生檢視</button>
                  <button onClick={printAutoArrange} className="chalk-btn text-sm bg-blue-600/70"><Printer className="w-4 h-4" /> 列印</button>
                </div>
              </div>

              {viewMode === 'week' ? (
                <div className="space-y-6">
                  {arrangementData.weeklyArrangements.map((w: any) => (
                    <div key={w.weekIndex} className="bg-black/20 p-4 rounded-lg border border-white/20">
                      <h3 className="font-bold text-yellow-300 text-lg mb-3">第 {w.weekIndex + 1} 週 <span className="text-sm text-white/50 ml-2">({getPrintDate(w.weekIndex)})</span></h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {w.items.map((it: any, i: number) => (
                          <div key={i} className="bg-white/5 p-2 rounded border border-white/10 text-sm flex flex-col">
                            <span className="font-bold text-white mb-1">{it.student.seatNo}號 {it.student.name}</span>
                            <span className="text-yellow-100 opacity-90 leading-tight">[{it.book?.bookNo || '-'}] {it.book?.title || '無'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {arrangementData.weeklyArrangements[0].items.map((it: any, studentIdx: number) => (
                    <div key={studentIdx} className="bg-black/20 p-4 rounded-lg border border-white/20">
                      <h3 className="font-bold text-yellow-300 text-lg mb-3">👤 {it.student.seatNo}號 {it.student.name}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {arrangementData.weeklyArrangements.map((w: any) => {
                          const studentItem = w.items[studentIdx];
                          return (
                            <div key={w.weekIndex} className="bg-white/5 p-2 rounded border border-white/10 text-xs flex flex-col">
                              <span className="font-bold text-white/50 mb-1">W{w.weekIndex + 1} ({getPrintDate(w.weekIndex)})</span>
                              <span className="text-yellow-100 opacity-90 leading-tight">[{studentItem.book?.bookNo || '-'}] {studentItem.book?.title || '無'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
