import { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Target, Search, PlusCircle, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Indicator {
  id: string;
  domain: string;
  ability: string;
  aspect: string;
  objective: string;
  age23: string;
  age34: string;
  age45: string;
  age56: string;
  remarks: Record<string, string>;
}

export default function Indicators() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [filterDomain, setFilterDomain] = useState('');
  const [filterAbility, setFilterAbility] = useState('');
  const [filterAspect, setFilterAspect] = useState('');
  const [filterObjective, setFilterObjective] = useState('');
  const [filterAge, setFilterAge] = useState('ALL');
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInd, setNewInd] = useState({
    domain: '', ability: '', aspect: '', objective: '', age23: '', age34: '', age45: '', age56: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'bear_indicators'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Indicator));
      setIndicators(data);
    });
    return () => unsubscribe();
  }, []);

  const domains = [...new Set(indicators.map(i => i.domain))].filter(Boolean);
  const abilities = [...new Set(indicators.filter(i => !filterDomain || i.domain === filterDomain).map(i => i.ability))].filter(Boolean);
  const aspects = [...new Set(indicators.filter(i => (!filterDomain || i.domain === filterDomain) && (!filterAbility || i.ability === filterAbility)).map(i => i.aspect))].filter(Boolean);
  const objectives = [...new Set(indicators.filter(i => (!filterDomain || i.domain === filterDomain) && (!filterAbility || i.ability === filterAbility) && (!filterAspect || i.aspect === filterAspect)).map(i => i.objective))].filter(Boolean);

  const filteredIndicators = indicators.filter(i => {
    if (filterDomain && i.domain !== filterDomain) return false;
    if (filterAbility && i.ability !== filterAbility) return false;
    if (filterAspect && i.aspect !== filterAspect) return false;
    if (filterObjective && i.objective !== filterObjective) return false;
    return true;
  }).sort((a, b) => (a.objective || '').localeCompare(b.objective || '', 'zh-TW', { numeric: true }));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'bear_indicators'), { ...newInd, remarks: {} });
      alert('新增成功！');
      setShowAddForm(false);
      setNewInd({ domain: '', ability: '', aspect: '', objective: '', age23: '', age34: '', age45: '', age56: '' });
    } catch (error) {
      console.error(error);
      alert('新增失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("確定刪除此指標嗎？")) {
      await deleteDoc(doc(db, 'bear_indicators', id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      <div className="chalk-box flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <Target className="w-8 h-8 text-yellow-300" />
          <h2 className="text-2xl font-bold">幼兒園學習指標查詢</h2>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="chalk-btn bg-white/10">
          <PlusCircle className="w-5 h-5" /> 新增指標
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="chalk-box border-yellow-400">
              <h3 className="text-xl font-bold mb-4 text-yellow-300">新增學習指標</h3>
              <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required placeholder="領域" value={newInd.domain} onChange={e => setNewInd({...newInd, domain: e.target.value})} className="chalk-input" />
                <input required placeholder="能力" value={newInd.ability} onChange={e => setNewInd({...newInd, ability: e.target.value})} className="chalk-input" />
                <input required placeholder="面向" value={newInd.aspect} onChange={e => setNewInd({...newInd, aspect: e.target.value})} className="chalk-input" />
                <input required placeholder="課程目標" value={newInd.objective} onChange={e => setNewInd({...newInd, objective: e.target.value})} className="chalk-input" />
                <textarea placeholder="2-3歲指標 (多筆請換行)" value={newInd.age23} onChange={e => setNewInd({...newInd, age23: e.target.value})} className="chalk-input resize-none" rows={3} />
                <textarea placeholder="3-4歲指標 (多筆請換行)" value={newInd.age34} onChange={e => setNewInd({...newInd, age34: e.target.value})} className="chalk-input resize-none" rows={3} />
                <textarea placeholder="4-5歲指標 (多筆請換行)" value={newInd.age45} onChange={e => setNewInd({...newInd, age45: e.target.value})} className="chalk-input resize-none" rows={3} />
                <textarea placeholder="5-6歲指標 (多筆請換行)" value={newInd.age56} onChange={e => setNewInd({...newInd, age56: e.target.value})} className="chalk-input resize-none" rows={3} />
                <div className="md:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddForm(false)} className="chalk-btn">取消</button>
                  <button type="submit" className="chalk-btn bg-green-600/80 hover:bg-green-500">儲存</button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chalk-box flex flex-wrap gap-4 items-center bg-black/20">
        <Search className="w-5 h-5 text-white/50" />
        <select value={filterDomain} onChange={e => {setFilterDomain(e.target.value); setFilterAbility(''); setFilterAspect(''); setFilterObjective('');}} className="chalk-input text-black bg-white rounded p-1">
          <option value="">全部領域</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterAbility} onChange={e => {setFilterAbility(e.target.value); setFilterAspect(''); setFilterObjective('');}} disabled={!filterDomain} className="chalk-input text-black bg-white rounded p-1">
          <option value="">全部能力</option>
          {abilities.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterAspect} onChange={e => {setFilterAspect(e.target.value); setFilterObjective('');}} disabled={!filterAbility} className="chalk-input text-black bg-white rounded p-1">
          <option value="">全部面向</option>
          {aspects.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterObjective} onChange={e => setFilterObjective(e.target.value)} disabled={!filterAspect} className="chalk-input text-black bg-white rounded p-1 max-w-[200px]">
          <option value="">全部課程目標</option>
          {objectives.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={filterAge} onChange={e => setFilterAge(e.target.value)} className="chalk-input text-black bg-white rounded p-1 ml-auto">
          <option value="ALL">顯示全部年齡</option>
          <option value="age23">2-3 歲</option>
          <option value="age34">3-4 歲</option>
          <option value="age45">4-5 歲</option>
          <option value="age56">5-6 歲</option>
        </select>
      </div>

      <div className="space-y-4">
        {filteredIndicators.length === 0 ? (
          <div className="chalk-box text-center py-12 text-white/50">找不到符合條件的指標</div>
        ) : (
          filteredIndicators.map((ind) => (
            <div key={ind.id} className="bg-black/20 border border-white/20 rounded-xl overflow-hidden shadow-inner">
              <div className="bg-white/10 p-3 border-b border-white/20 flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="bg-purple-600/60 px-2 py-1 rounded tracking-wider">{ind.domain}</span>
                  <span className="text-white/50">&gt;</span>
                  <span className="bg-blue-600/60 px-2 py-1 rounded tracking-wider">{ind.ability}</span>
                  <span className="text-white/50">&gt;</span>
                  <span className="bg-green-600/60 px-2 py-1 rounded tracking-wider">{ind.aspect}</span>
                </div>
                <div className="w-full mt-2 flex justify-between items-center group">
                  <span className="text-lg font-bold text-yellow-300 break-all pr-2">{ind.objective}</span>
                  <button onClick={() => handleDelete(ind.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
              
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                {(filterAge === 'ALL' || filterAge === 'age23') && ind.age23 && (
                  <div>
                    <div className="text-orange-300 font-bold border-b border-white/10 mb-2 pb-1">2-3 歲</div>
                    <div className="whitespace-pre-wrap text-white/90 bg-white/5 p-2 rounded">{ind.age23}</div>
                  </div>
                )}
                {(filterAge === 'ALL' || filterAge === 'age34') && ind.age34 && (
                  <div>
                    <div className="text-orange-300 font-bold border-b border-white/10 mb-2 pb-1">3-4 歲</div>
                    <div className="whitespace-pre-wrap text-white/90 bg-white/5 p-2 rounded">{ind.age34}</div>
                  </div>
                )}
                {(filterAge === 'ALL' || filterAge === 'age45') && ind.age45 && (
                  <div>
                    <div className="text-orange-300 font-bold border-b border-white/10 mb-2 pb-1">4-5 歲</div>
                    <div className="whitespace-pre-wrap text-white/90 bg-white/5 p-2 rounded">{ind.age45}</div>
                  </div>
                )}
                {(filterAge === 'ALL' || filterAge === 'age56') && ind.age56 && (
                  <div>
                    <div className="text-orange-300 font-bold border-b border-white/10 mb-2 pb-1">5-6 歲</div>
                    <div className="whitespace-pre-wrap text-white/90 bg-white/5 p-2 rounded">{ind.age56}</div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
