import React, { useState, useRef, useEffect } from 'react';
// 1. 引入 Upload 图标
import { 
  Plus, Trash2, Clock, Copy, User, Edit3, CalendarPlus, PenTool, 
  Image as ImageIcon, Sparkles, RefreshCw, Users, Palette, Settings, Shield, Save, X, Zap, 
  Globe, PieChart, ChevronRight, CalendarCheck, Upload
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('list');
  const [listType, setListType] = useState('incoming');

  // --- 数据持久化改造开始 ---

  // 1. 初始化用户配置：优先从 LocalStorage 读取
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('debt_user_profile');
      return saved ? JSON.parse(saved) : { name: '', idCard: '' };
    } catch (e) {
      return { name: '', idCard: '' };
    }
  });

  // 2. 初始化账单数据：优先从 LocalStorage 读取
  const [debts, setDebts] = useState(() => {
    try {
      const saved = localStorage.getItem('debt_data_list');
      // 如果本地有数据，就用本地的；否则用默认示例
      return saved ? JSON.parse(saved) : [
        { id: 1, type: 'incoming', name: '张三', amount: 500, dueDate: '2023-12-31', dueTime: '18:00', reason: '聚餐垫付', status: 'overdue', addToCalendar: false },
        { id: 2, type: 'incoming', name: '李四', amount: 2000, dueDate: '2025-12-01', dueTime: '12:00', reason: '周转借款', status: 'pending', addToCalendar: false },
        { id: 3, type: 'outgoing', name: '王五', amount: 1000, dueDate: '2024-05-20', dueTime: '09:00', reason: '房租周转', status: 'pending', addToCalendar: true }
      ];
    } catch (e) {
      return [];
    }
  });

  // 3. 监听数据变化，自动保存到 LocalStorage
  useEffect(() => {
    localStorage.setItem('debt_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('debt_data_list', JSON.stringify(debts));
  }, [debts]);

  // --- 数据持久化改造结束 ---

  const [newDebt, setNewDebt] = useState({
    type: 'incoming', name: '', amount: '', dueDate: '', dueTime: '12:00', reason: '', addToCalendar: false
  });

  const [showShareModal, setShowShareModal] = useState(false);
  const [currentShareItem, setCurrentShareItem] = useState(null);
  
  // 移除 ReminderModal 相关状态 (showReminderModal 等) 已彻底删除，不再报错
  
  const [aiOptions, setAiOptions] = useState({ audience: '朋友', style: '正常' });
  const [aiGeneratedMessage, setAiGeneratedMessage] = useState('');
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  const [commitmentForm, setCommitmentForm] = useState({ 
    myName: '', idCard: '', includePenalty: false, penalty: '承担相应的法律责任及所有催收费用' 
  });
  
  const signatureCanvasRef = useRef(null);
  // 2. 添加文件输入的引用
  const fileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  const wxGreen = 'bg-[#07c160]';
  const wxBg = 'bg-[#f5f5f5]';
  const wxRed = 'bg-[#fa5151]';

  // --- AI 文案生成 ---
  const callDeepSeek = async (systemPrompt, userPrompt) => {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '请求失败');
      }

      return data.choices?.[0]?.message?.content || "";
    } catch (e) {
      alert(`AI 暂时不可用。错误: ${e.message}`);
      return null;
    }
  };

  const handleAiRewrite = async (newAudience, newStyle) => {
    const aud = newAudience || aiOptions.audience;
    const sty = newStyle || aiOptions.style;
    setAiOptions({ audience: aud, style: sty });
    setIsGeneratingMessage(true);
    const base = `${currentShareItem.name}，你借的${currentShareItem.amount}元（原因：${currentShareItem.reason}）该还了。`;
    const res = await callDeepSeek("你是一个高情商催收助手。", `将此信息改写给"${aud}"，语气"${sty}"：${base}。要求100字内，直接返回正文。`);
    if (res) setAiGeneratedMessage(res);
    setIsGeneratingMessage(false);
  };

  // --- 业务逻辑 ---
  // 生成 ICS 文件并下载（添加到手机日历）
  const generateIcsFile = (item) => {
    const title = item.type === 'incoming' ? `有借有还：${item.name}应还款` : `有借有还：还给${item.name}`;
    const dateStr = item.dueDate.replace(/-/g, '');
    const timeStr = item.dueTime.replace(/:/g, '');
    const start = `${dateStr}T${timeStr}00`;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//FanKeJi//DebtCollector//CN
BEGIN:VEVENT
SUMMARY:${title}
DTSTART;TZID=Asia/Shanghai:${start}
DTEND;TZID=Asia/Shanghai:${start}
DESCRIPTION:金额：${item.amount}元\\n备注：${item.reason}
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Reminder
END:VALARM
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `event-${item.name}-${item.dueDate}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddDebt = () => {
    if (!newDebt.name || !newDebt.amount || !newDebt.dueDate) return alert('请完善信息');
    const item = { ...newDebt, id: Date.now(), status: 'pending' };
    setDebts([...debts, item]);
    
    if (newDebt.addToCalendar) {
        generateIcsFile(item);
    }
    
    setNewDebt({ type: 'incoming', name: '', amount: '', dueDate: '', dueTime: '12:00', reason: '', addToCalendar: false });
    setActiveTab('list');
  };

  // 3. 备份数据功能 (更新：增加小白用户友好的注释和说明)
  const backupData = () => {
    const exportData = {
      "___使用说明___": "1. 您可以直接编辑此文件来批量添加账单。 2. 请勿修改左侧英文键名（如 name），只修改右侧的值。 3. 修改完成后，在App点击'恢复账单数据'上传。",
      "___字段填写指南___": {
        "type": "填写 'incoming' (别人欠我) 或 'outgoing' (我欠别人)",
        "name": "对方姓名",
        "amount": "金额 (纯数字，不要加符号)",
        "dueDate": "日期 (格式必须为 YYYY-MM-DD)",
        "dueTime": "时间 (格式为 HH:MM)",
        "reason": "备注原因",
        "status": "填写 'pending' (进行中) 或 'overdue' (已逾期)",
        "addToCalendar": "true (开启日历) 或 false (关闭)"
      },
      userProfile,
      debts
    };

    // 使用 JSON.stringify 的第三个参数 (2) 来添加缩进和换行，使 JSON 易读易编辑
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `有借有还_备份_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 4. 恢复数据功能
  const handleRestoreData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // 简单的数据校验
        if (data.debts && Array.isArray(data.debts)) {
          if (window.confirm(`检测到备份文件，包含 ${data.debts.length} 条账单。\n确认覆盖当前数据吗？`)) {
            setDebts(data.debts);
            if (data.userProfile) setUserProfile(data.userProfile);
            alert('数据恢复成功！');
          }
        } else {
          alert('文件格式错误，无法恢复。请确认上传的是正确的备份文件。');
        }
      } catch (error) {
        alert('解析备份文件失败，JSON 格式可能有误。');
      }
    };
    reader.readAsText(file);
    // 清空 input 值，允许重复选择同一文件
    event.target.value = '';
  };

  const getStatusBadge = (date) => {
    const today = new Date().toISOString().split('T')[0];
    if (date < today) return <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">已逾期</span>;
    if (date === today) return <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">今日到期</span>;
    return <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">待处理</span>;
  };

  // --- 签名逻辑 ---
  const startDrawing = (e) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    ctx.lineTo(x, y); ctx.stroke(); e.preventDefault();
  };
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = signatureCanvasRef.current;
      if (canvas) setSignatureData(canvas.toDataURL());
    }
  };
  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
    }
  };

  const generateMessage = () => {
    if (aiGeneratedMessage && currentShareItem.type === 'incoming') return aiGeneratedMessage;
    if (currentShareItem.type === 'outgoing') {
        let text = `借款承诺书\n\n本人 ${commitmentForm.myName || '___'} (身份证号: ${commitmentForm.idCard || '__________________'}) 承诺于 ${currentShareItem.dueDate} 前向 ${currentShareItem.name} 偿还人民币 ${Number(currentShareItem.amount).toLocaleString()} 元。`;
        if (commitmentForm.includePenalty) text += `\n\n违约责任：若未按时归还，本人愿${commitmentForm.penalty}。`;
        text += `\n\n承诺人：${commitmentForm.myName || '___'}\n日期：${new Date().toLocaleDateString()}`;
        return text;
    }
    return `${currentShareItem.name}，借给你的${currentShareItem.amount}元（原因：${currentShareItem.reason || '无备注'}）记得在${currentShareItem.dueDate} ${currentShareItem.dueTime}前还哦。`;
  };

  // --- Canvas 图片合成与下载逻辑 ---
  const generateImage = () => {
    if (!currentShareItem) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2; 
    const width = 600;
    const padding = 40;
    const lineHeight = 35;
    const fontSize = 20;
    
    const textContent = generateMessage();
    const paragraphs = textContent.split('\n');
    const lines = [];
    
    ctx.font = `${fontSize}px serif`;
    
    paragraphs.forEach(para => {
       if(para === '') {
           lines.push('');
           return;
       }
       let line = '';
       for(let char of para) {
           if(ctx.measureText(line + char).width > width - padding*2) {
               lines.push(line);
               line = char;
           } else {
               line += char;
           }
       }
       lines.push(line);
    });

    const contentHeight = lines.length * lineHeight;
    const signatureAreaHeight = (signatureData && currentShareItem.type === 'outgoing') ? 140 : 0;
    const canvasHeight = padding * 2 + contentHeight + signatureAreaHeight + 60;

    canvas.width = width * scale;
    canvas.height = canvasHeight * scale;
    ctx.scale(scale, scale);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, canvasHeight);

    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#e5e7eb';
    ctx.textAlign = 'center';
    ctx.fillText('有借有还 App 生成', width/2, 20); // 修改水印文案

    ctx.fillStyle = '#1f2937';
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    let y = padding;
    lines.forEach(line => {
        ctx.fillText(line, padding, y);
        y += lineHeight;
    });

    if (signatureData && currentShareItem.type === 'outgoing') {
        const img = new Image();
        img.onload = () => {
            const sigWidth = 140;
            const sigHeight = (img.height / img.width) * sigWidth;
            const sigX = width - padding - sigWidth;
            const sigY = y + 30;
            
            ctx.drawImage(img, sigX, sigY, sigWidth, sigHeight);
            
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#9ca3af';
            ctx.textAlign = 'right';
            ctx.fillText('签署人手写签名：', sigX - 10, sigY + sigHeight/2);
            
            downloadCanvas(canvas);
        };
        img.src = signatureData;
    } else {
        downloadCanvas(canvas);
    }
  };

  const downloadCanvas = (canvas) => {
      const link = document.createElement('a');
      link.download = `借款承诺书_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
  };

  return (
    <div className={`h-[100dvh] w-screen ${wxBg} flex justify-center overflow-hidden`}>
      <div className="w-full md:max-w-md bg-white h-full shadow-xl relative flex flex-col">
        {/* Header */}
        <div className="bg-[#ededed] px-4 py-3 flex items-center justify-between border-b border-gray-300 sticky top-0 z-20 shrink-0">
          <div className="font-semibold text-lg flex items-center gap-2">
            有借有还 <Zap size={14} className="text-yellow-500" fill="currentColor"/>
          </div>
          <div className="flex gap-2 items-center">
             <div className="text-[10px] text-gray-400 bg-gray-200 px-2 py-1 rounded-full">AI Ready</div>
             <Globe size={18} className="text-gray-400" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {activeTab === 'list' && (
            <div className="p-4 space-y-4">
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setListType('incoming')} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${listType === 'incoming' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500'}`}>待收回 (讨债)</button>
                <button onClick={() => setListType('outgoing')} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${listType === 'outgoing' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'}`}>待偿还 (欠款)</button>
              </div>
              <div className={`${listType === 'incoming' ? wxGreen : wxRed} text-white rounded-2xl p-6 shadow-lg transition-all`}>
                <div className="text-xs opacity-80 mb-1">{listType === 'incoming' ? '待收回总金额' : '待偿还总金额'}</div>
                <div className="text-3xl font-bold">¥ {debts.filter(d => d.type === listType).reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}</div>
                <div className="mt-4 flex items-center gap-1 text-[10px] opacity-70"><Shield size={12}/> 账目公开透明，诚信走天下</div>
              </div>
              <div className="space-y-3">
                {debts.filter(d => d.type === listType).length === 0 ? <div className="text-center py-10 text-gray-400 text-sm">暂无账单</div> : 
                debts.filter(d => d.type === listType).map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${item.type==='incoming'?'bg-green-500':'bg-red-400'}`}>{item.name.charAt(0)}</div>
                        <div><div className="font-bold text-gray-800">{item.name}</div><div className="text-[10px] text-gray-400">{item.reason || '无备注'}</div></div>
                      </div>
                      <div className="text-right"><div className={`font-bold text-lg ${item.type==='incoming'?'text-green-600':'text-red-500'}`}>¥{Number(item.amount).toLocaleString()}</div>{getStatusBadge(item.dueDate)}</div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                        <div className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {item.dueDate}</div>
                        <div className="flex gap-2">
                            {/* 将之前的 Bell 按钮替换为日历按钮，点击直接下载 ICS */}
                            <button 
                                onClick={() => generateIcsFile(item)}
                                className="p-1.5 text-gray-300 hover:text-blue-500" 
                                title="添加到日历"
                            >
                                <CalendarPlus size={16}/>
                            </button>
                            <button onClick={() => setDebts(debts.filter(d=>d.id!==item.id))} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                            <button onClick={() => { setCurrentShareItem(item); setAiGeneratedMessage(''); setSignatureData(null); setCommitmentForm({myName: userProfile.name, idCard: userProfile.idCard, includePenalty: false, penalty: '承担相应的法律责任及所有催收费用'}); setShowShareModal(true); }} className={`${item.type === 'incoming' ? wxGreen : 'bg-red-500'} text-white text-xs px-4 py-1.5 rounded-full font-bold shadow-sm`}>{item.type === 'incoming' ? 'AI 催收' : '签承诺书'}</button>
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'add' && (
            <div className="p-4 space-y-6">
              <h2 className="text-xl font-bold">记一笔新账</h2>
              <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={()=>setNewDebt({...newDebt, type:'incoming'})} className={`py-3 rounded-xl border-2 font-bold text-sm ${newDebt.type==='incoming'?'border-green-500 bg-green-50 text-green-700':'border-gray-100 text-gray-400'}`}>借给别人</button>
                    <button onClick={()=>setNewDebt({...newDebt, type:'outgoing'})} className={`py-3 rounded-xl border-2 font-bold text-sm ${newDebt.type==='outgoing'?'border-red-500 bg-red-50 text-red-700':'border-gray-100 text-gray-400'}`}>欠别人钱</button>
                </div>
                <div className="space-y-4">
                    <div className="border-b pb-1"><label className="text-[10px] text-gray-400 block ml-1">对方姓名</label><input type="text" placeholder="输入真实姓名" className="w-full p-2 outline-none font-medium" value={newDebt.name} onChange={e=>setNewDebt({...newDebt, name: e.target.value})} /></div>
                    <div className="border-b pb-1"><label className="text-[10px] text-gray-400 block ml-1">金额 (元)</label><input type="number" placeholder="0.00" className="w-full p-2 outline-none text-2xl font-bold" value={newDebt.amount} onChange={e=>setNewDebt({...newDebt, amount: e.target.value})} /></div>
                    <div className="border-b pb-1"><label className="text-[10px] text-gray-400 block ml-1">约定还款时间</label><div className="flex gap-2"><input type="date" className="flex-1 p-2 outline-none text-sm" value={newDebt.dueDate} onChange={e=>setNewDebt({...newDebt, dueDate: e.target.value})} /><input type="time" className="w-24 p-2 outline-none text-sm text-gray-500" value={newDebt.dueTime} onChange={e=>setNewDebt({...newDebt, dueTime: e.target.value})} /></div></div>
                    <div className="border-b pb-1"><label className="text-[10px] text-gray-400 block ml-1">原因备注</label><input type="text" placeholder="例如：聚餐垫付" className="w-full p-2 outline-none text-sm" value={newDebt.reason} onChange={e=>setNewDebt({...newDebt, reason: e.target.value})} /></div>
                </div>
                <button onClick={handleAddDebt} className={`w-full ${newDebt.type==='incoming'?wxGreen:'bg-red-500'} text-white py-4 rounded-2xl font-bold shadow-lg`}>保存账单</button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-4 space-y-5">
              <h2 className="text-xl font-bold px-1">设置与资产</h2>
              <div className="bg-gray-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <PieChart className="absolute -right-4 -top-4 opacity-10 w-24 h-24" />
                <div className="text-[10px] opacity-50 mb-1">当前净资产 (借出-欠款)</div>
                <div className="text-2xl font-bold mb-4">¥ {(debts.filter(d=>d.type==='incoming').reduce((s,i)=>s+Number(i.amount),0) - debts.filter(d=>d.type==='outgoing').reduce((s,i)=>s+Number(i.amount),0)).toLocaleString()}</div>
                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                    <div><div className="text-[10px] opacity-50 text-green-400">总应收</div><div className="font-bold">¥ {debts.filter(d=>d.type==='incoming').reduce((s,i)=>s+Number(i.amount),0).toLocaleString()}</div></div>
                    <div><div className="text-[10px] opacity-50 text-red-400">总应付</div><div className="font-bold">¥ {debts.filter(d=>d.type==='outgoing').reduce((s,i)=>s+Number(i.amount),0).toLocaleString()}</div></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-4">
                <div className="flex items-center gap-2 font-bold text-gray-700 border-b pb-2"><User size={18} className="text-blue-500"/> 身份信息预设</div>
                <input type="text" placeholder="我的真实姓名" className="w-full p-2 border rounded-lg text-sm" value={userProfile.name} onChange={e=>setUserProfile({...userProfile, name: e.target.value})} />
                <input type="text" placeholder="我的身份证号" className="w-full p-2 border rounded-lg text-sm" value={userProfile.idCard} onChange={e=>setUserProfile({...userProfile, idCard: e.target.value})} />
              </div>

              {/* 5. 绑定备份和恢复按钮 */}
              <div className="space-y-2">
                <button onClick={backupData} className="w-full flex justify-between p-4 bg-white rounded-xl border text-sm text-gray-600">
                    <span className="flex items-center gap-2"><Save size={16}/> 导出账单备份 (JSON)</span><ChevronRight size={16}/>
                </button>
                <button onClick={() => fileInputRef.current.click()} className="w-full flex justify-between p-4 bg-white rounded-xl border text-sm text-gray-600">
                    <span className="flex items-center gap-2"><Upload size={16}/> 恢复账单数据</span><ChevronRight size={16}/>
                </button>
                {/* 隐藏的文件输入框 */}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  style={{ display: 'none' }} 
                  accept=".json" 
                  onChange={handleRestoreData} 
                />
                
                <button onClick={()=>{ if(window.confirm('确定要清空所有数据吗？')) setDebts([]); }} className="w-full flex justify-between p-4 bg-red-50 rounded-xl border border-red-100 text-sm text-red-600">
                    <span className="flex items-center gap-2"><Trash2 size={16}/> 清空本地所有账单</span><ChevronRight size={16}/>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t flex justify-around py-3 absolute bottom-0 w-full z-20 shrink-0">
          <button onClick={() => setActiveTab('list')} className={`flex flex-col items-center gap-1 ${activeTab === 'list' ? 'text-green-600 font-bold' : 'text-gray-400'}`}><Clock size={22} /><span className="text-[10px]">账本</span></button>
          <button onClick={() => setActiveTab('add')} className="flex items-center justify-center -mt-8"><div className={`${wxGreen} w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-[#f5f5f5]`}><Plus size={30}/></div></button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-green-600 font-bold' : 'text-gray-400'}`}><Settings size={22} /><span className="text-[10px]">设置</span></button>
        </div>

        {/* Share Modal */}
        {showShareModal && currentShareItem && (
          <div className="absolute inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl animate-fade-in-up flex flex-col relative">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
                    <span className="font-bold text-gray-700">{currentShareItem.type === 'incoming' ? '有借有还 AI 助手' : '借款承诺书预览'}</span>
                    <button onClick={() => setShowShareModal(false)} className="text-gray-400 text-2xl px-2">&times;</button>
                </div>
                <div className="p-5 space-y-4">
                    {currentShareItem.type === 'incoming' ? (
                        <div className="space-y-4">
                            <div><label className="text-[10px] text-gray-400 block mb-2 font-bold">接收对象：</label><div className="grid grid-cols-3 gap-2">{['朋友', '同事', '同学', '亲属', '领导', '下属'].map(a => <button key={a} onClick={() => handleAiRewrite(a, null)} className={`py-2 text-xs rounded-lg border ${aiOptions.audience === a ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold' : 'bg-white text-gray-600'}`}>{a}</button>)}</div></div>
                            <div><label className="text-[10px] text-gray-400 block mb-2 font-bold">语气风格：</label><div className="grid grid-cols-3 gap-2">{['正常', '幽默', '绿茶', '古风', '发疯文学'].map(s => <button key={s} onClick={() => handleAiRewrite(null, s)} className={`py-2 text-xs rounded-lg border ${aiOptions.style === s ? 'bg-pink-50 border-pink-500 text-pink-700 font-bold' : 'bg-white text-gray-600'}`}>{s}</button>)}</div></div>
                        </div>
                    ) : (
                        <div className="space-y-4 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <input type="text" placeholder="承诺人姓名" className="w-full p-2 rounded-lg border border-blue-200 text-sm" value={commitmentForm.myName} onChange={e=>setCommitmentForm({...commitmentForm, myName: e.target.value})} />
                            <input type="text" placeholder="身份证号" className="w-full p-2 rounded-lg border border-blue-200 text-sm" value={commitmentForm.idCard} onChange={e=>setCommitmentForm({...commitmentForm, idCard: e.target.value})} />
                            <div className="flex items-center gap-2"><input type="checkbox" id="penalty" checked={commitmentForm.includePenalty} onChange={e=>setCommitmentForm({...commitmentForm, includePenalty: e.target.checked})} /><label htmlFor="penalty" className="text-xs text-gray-700">添加延期还款违约责任</label></div>
                            {commitmentForm.includePenalty && <textarea className="w-full p-2 text-xs rounded-lg border border-blue-200 h-16" placeholder="输入违约责任..." value={commitmentForm.penalty} onChange={e=>setCommitmentForm({...commitmentForm, penalty: e.target.value})} />}
                        </div>
                    )}
                    <div className="bg-[#f7f7f7] p-5 rounded-2xl text-sm min-h-[140px] text-gray-700 leading-relaxed border relative shadow-inner">
                        {isGeneratingMessage ? <div className="flex items-center gap-2 text-indigo-500 justify-center h-24"><RefreshCw size={14} className="animate-spin" /> DeepSeek 构思中...</div> : <div className="whitespace-pre-wrap font-serif">{generateMessage()}{signatureData && currentShareItem.type === 'outgoing' && <div className="mt-6 text-right"><img src={signatureData} className="h-10 inline-block mix-blend-multiply" alt="签名预览" /></div>}</div>}
                    </div>
                    {currentShareItem.type === 'outgoing' && (
                        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                            <div className="text-[10px] text-gray-400 p-2 border-b flex justify-between items-center bg-gray-50"><span>请在下方手写签名：</span><button onClick={clearSignature} className="text-red-500 font-bold px-2 py-1 rounded">清除</button></div>
                            <canvas ref={signatureCanvasRef} width={350} height={140} className="w-full touch-none cursor-crosshair" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}/>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button onClick={() => { const t = generateMessage(); const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); alert('已复制'); }} className={`py-4 ${wxGreen} text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95`}><Copy size={18}/> 复制</button>
                        <button onClick={generateImage} className="py-4 bg-gray-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95"><ImageIcon size={18}/> 生成图片</button>
                    </div>
                </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.3s ease-out; } .animate-fade-in-up { animation: fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }`}</style>
    </div>
  );
}