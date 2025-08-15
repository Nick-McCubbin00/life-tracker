import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Trash2, CalendarDays, ShoppingCart, Star } from 'lucide-react';

// Helper to format date to 'YYYY-MM-DD'
const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    // Adjust for timezone offset to prevent date shifts
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Main App Component
export default function App() {
    // State management
    const [activeTab, setActiveTab] = useState('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDayStr, setSelectedDayStr] = useState(null);
    const [remoteError, setRemoteError] = useState('');
    const [usingBlob, setUsingBlob] = useState(true);
    const [infoMessage, setInfoMessage] = useState('');
    const infoTimerRef = useRef(null);

    // Collections
    const [tasks, setTasks] = useState([]);      // {id, title, date(YYYY-MM-DD), done, recurrence}
    const [events, setEvents] = useState([]);    // {id, title, date(YYYY-MM-DD)}
    const [groceries, setGroceries] = useState([]); // {id, name, quantity, checked}
    const [requests, setRequests] = useState([]);   // {id, title, details, priority, requestedDueDate, approved, approvedDueDate, status}

    // Inputs (day modal)
    const [newItemType, setNewItemType] = useState('task'); // 'task' | 'event'
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newTaskRecurrence, setNewTaskRecurrence] = useState('none'); // none | daily | weekly | biweekly | monthly
    const [newRequestTitle, setNewRequestTitle] = useState('');
    const [newRequestPriority, setNewRequestPriority] = useState('medium');
    const [requestDetails, setRequestDetails] = useState('');

    // Groceries inputs
    const [groceryName, setGroceryName] = useState('');
    const [groceryQty, setGroceryQty] = useState('');

    // Requests tab inputs
    const [reqFormTitle, setReqFormTitle] = useState('');
    const [reqFormPriority, setReqFormPriority] = useState('medium');
    const [reqFormDueDate, setReqFormDueDate] = useState('');
    const [reqFormDetails, setReqFormDetails] = useState('');

    // Sidebar filter
    const [sidebarRecurrence, setSidebarRecurrence] = useState('daily'); // daily | weekly | biweekly | monthly

    // Inline editing state for modal items
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskTitle, setEditTaskTitle] = useState('');
    const [editTaskNotes, setEditTaskNotes] = useState('');
    const [editingEventId, setEditingEventId] = useState(null);
    const [editEventTitle, setEditEventTitle] = useState('');
    const [editEventNotes, setEditEventNotes] = useState('');

    // Backup/Restore in-progress state
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Load state from Blob first, fallback to localStorage
    useEffect(() => {
        // Prefer Blob state when available (no Firebase required)
        const tryLoadBlob = async () => {
            try {
                const resp = await fetch('/api/state');
                if (!resp.ok) throw new Error('Blob load failed');
                const json = await resp.json();
                const d = json?.data || {};
                if (Array.isArray(d.events)) setEvents(d.events);
                if (Array.isArray(d.tasks)) setTasks(d.tasks);
                if (Array.isArray(d.groceries)) setGroceries(d.groceries);
                if (Array.isArray(d.requests)) setRequests(d.requests);
                setUsingBlob(true);
            } catch (_) {
                setUsingBlob(false);
            }
        };
        tryLoadBlob();
        {
            try {
                const savedTasks = localStorage.getItem('tasks');
                if (savedTasks) {
                    const parsed = JSON.parse(savedTasks);
                    if (Array.isArray(parsed)) setTasks(parsed);
                }
            } catch (_) {}
            try {
                const savedGroceries = localStorage.getItem('groceries');
                if (savedGroceries) {
                    const parsed = JSON.parse(savedGroceries);
                    if (Array.isArray(parsed)) setGroceries(parsed);
            }
        } catch (_) {}
            try {
                const savedRequests = localStorage.getItem('requests');
                if (savedRequests) {
                    const parsed = JSON.parse(savedRequests);
                    if (Array.isArray(parsed)) setRequests(parsed);
                }
            } catch (_) {}
            try {
                const savedEvents = localStorage.getItem('events');
                if (savedEvents) {
                    const parsed = JSON.parse(savedEvents);
                    if (Array.isArray(parsed)) setEvents(parsed);
                }
            } catch (_) {}
        }
    }, []);

    // Persist to Blob (debounced) and localStorage as cache
    useEffect(() => {
        const save = setTimeout(async () => {
            if (!usingBlob) return;
            try {
                await fetch('/api/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        events,
                        tasks,
                        groceries,
                        requests,
                        savedAt: new Date().toISOString(),
                    }),
                });
        } catch (_) {}
        }, 400);
        return () => clearTimeout(save);
    }, [events, tasks, groceries, requests, usingBlob]);

    // Persist collections
    useEffect(() => { try { localStorage.setItem('events', JSON.stringify(events)); } catch (_) {} }, [events]);
    useEffect(() => { try { localStorage.setItem('tasks', JSON.stringify(tasks)); } catch (_) {} }, [tasks]);
    useEffect(() => { try { localStorage.setItem('groceries', JSON.stringify(groceries)); } catch (_) {} }, [groceries]);
    useEffect(() => { try { localStorage.setItem('requests', JSON.stringify(requests)); } catch (_) {} }, [requests]);

    // Memoized values for calendar generation to prevent recalculation on every render
    const { month, year, daysInMonth, firstDayOfMonth } = useMemo(() => {
        const month = currentDate.getMonth();
        const year = currentDate.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        return { month, year, daysInMonth, firstDayOfMonth };
    }, [currentDate]);

    // Handlers for month navigation
    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    // Utilities
    const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Tasks (as checklist items themselves)
    const addTaskForDay = (dayStr, title, recurrence = 'none') => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        setTasks((prev) => [...prev, { id, title: trimmed, date: dayStr, completedDates: [], recurrence, notes: '' }]);
    };
    const toggleTaskDone = (taskId, dayStr) => {
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const list = Array.isArray(t.completedDates) ? [...t.completedDates] : [];
            const idx = list.indexOf(dayStr);
            if (idx >= 0) list.splice(idx, 1); else list.push(dayStr);
            return { ...t, completedDates: list };
        }));
    };
    const deleteTask = (taskId) => {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    // Events
    const addEventForDay = (dayStr, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        setEvents((prev) => [...prev, { id, title: trimmed, date: dayStr, notes: '' }]);
    };
    const deleteEvent = (eventId) => {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
    };

    // Groceries
    const handleAddGrocery = () => {
        const name = groceryName.trim();
        if (!name) return;
        const id = generateId();
        const payload = { id, name, quantity: groceryQty.trim() || '1', checked: false };
        setGroceries((prev) => [...prev, payload]);
        setGroceryName('');
        setGroceryQty('');
    };
    const toggleGrocery = (groceryId) => {
        setGroceries((prev) => prev.map((g) => g.id === groceryId ? { ...g, checked: !g.checked } : g));
    };
    const clearCheckedGroceries = () => {
        setGroceries((prev) => prev.filter((g) => !g.checked));
    };
    const deleteGrocery = (groceryId) => {
        setGroceries((prev) => prev.filter((g) => g.id !== groceryId));
    };

    // Requests
    const handleAddRequest = (dueDayStr, title, priority, details) => {
        const t = title.trim();
        if (!t) return;
        const id = generateId();
        const payload = {
            id,
            title: t,
            details: (details || '').trim(),
            priority,
            requestedDueDate: new Date(dueDayStr).toISOString(),
            approved: false,
            approvedDueDate: null,
            status: 'pending',
        };
        setRequests((prev) => [...prev, payload]);
        setNewRequestTitle('');
        setRequestDetails('');
        setNewRequestPriority('medium');
    };
    const approveRequest = (requestId, newDueDateStr) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, approved: true, status: 'approved', approvedDueDate: newDueDateStr ? new Date(newDueDateStr).toISOString() : (r.requestedDueDate || null) } : r));
    };
    const completeRequest = (requestId) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'completed' } : r));
    };
    const deleteRequest = (requestId) => {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
    };

    // Calendar rendering logic
    const occursOnDay = (task, dayDate) => {
        // task.date is base date string (YYYY-MM-DD)
        try {
            const base = new Date(task.date + 'T00:00:00');
            const target = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
            if (target < base) return false;
            const diffDays = Math.floor((target - base) / (1000 * 60 * 60 * 24));
            const rec = task.recurrence || 'none';
            if (rec === 'none') return diffDays === 0;
            if (rec === 'daily') return true;
            if (rec === 'weekly') return diffDays % 7 === 0;
            if (rec === 'biweekly') return diffDays % 14 === 0;
            if (rec === 'monthly') {
                return target.getDate() === base.getDate();
            }
            return false;
        } catch (_) { return false; }
    };

    const isTaskDoneOnDate = (task, dayStr) => Array.isArray(task.completedDates) && task.completedDates.includes(dayStr);

    const renderCalendar = () => {
        const calendarDays = [];
        const today = new Date();
        const todayStr = formatDate(today);

        // Add blank cells for days before the 1st of the month
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarDays.push(<div key={`empty-start-${i}`} className="border-r border-b border-gray-200"></div>);
        }

        // Add cells for each day of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const dayStr = formatDate(dayDate);

            let dayClasses = "relative p-2 h-36 text-xs border-r border-b border-gray-200 flex flex-col justify-start items-start transition-colors duration-200 overflow-hidden";
            if (dayStr === todayStr) dayClasses += " bg-blue-50";

            const tasksToday = tasks.filter(t => t.recurrence !== 'daily' && occursOnDay(t, dayDate));
            const eventsToday = events.filter(e => e.date === dayStr);
            const requestsToday = requests.filter(r => r.status === 'approved' && r.approvedDueDate && formatDate(r.approvedDueDate) === dayStr);

            calendarDays.push(
                <div
                    key={dayStr}
                    className={dayClasses + " cursor-pointer hover:bg-gray-50"}
                    onClick={() => setSelectedDayStr(dayStr)}
                >
                    <span className="font-medium text-gray-700">{day}</span>
                    <div className="mt-1 w-full space-y-1">
                        {eventsToday.map((ev) => (
                            <div key={`ev-${ev.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate" style={{ backgroundColor: '#E6E6FA' }} title={ev.title}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate text-gray-800">{ev.title}</span>
                                    <button className="text-gray-600 hover:text-gray-900" onClick={(e)=>{ e.stopPropagation(); deleteEvent(ev.id); }}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                        {tasksToday.map((t) => (
                            <div key={`t-${t.id}`} className="w-full text-[10px] bg-blue-500 text-white rounded-lg shadow px-1.5 py-0.5 truncate flex items-center gap-1">
                                <span className={`truncate ${isTaskDoneOnDate(t, dayStr) ? 'line-through' : ''}`}>{t.title}</span>
                                {t.recurrence && t.recurrence !== 'none' && <span className="ml-1 opacity-80">({t.recurrence})</span>}
                                <button className="ml-auto hover:bg-white/10 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteTask(t.id); }}><Trash2 size={12} /></button>
                            </div>
                        ))}
                        {requestsToday.map((r) => (
                            <div key={`rq-${r.id}`} className="w-full text-[10px] rounded-lg shadow px-1.5 py-0.5 truncate" style={{ backgroundColor: '#ffd6e7', color: '#7a2946' }} title={`${r.title} (${r.priority})`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate">{r.title}</span>
                                    <button className="hover:bg-black/5 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteRequest(r.id); }}><Trash2 size={12} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        // Fill remaining grid cells
        const totalCells = 42; // 6 weeks * 7 days
        while(calendarDays.length % 7 !== 0 || calendarDays.length < totalCells) {
            calendarDays.push(<div key={`empty-end-${calendarDays.length}`} className="border-r border-b border-gray-200"></div>);
        }

        return calendarDays;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-7xl mx-auto space-y-4">

                {/* Tabs */}
                <div className="bg-white p-2 rounded-2xl shadow border border-gray-200">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setActiveTab('calendar')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><CalendarDays size={16} /> Calendar</button>
                        <button onClick={() => setActiveTab('groceries')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='groceries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><ShoppingCart size={16} /> Groceries</button>
                        <button onClick={() => setActiveTab('requests')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Star size={16} /> Requests</button>
                        <div className="ml-auto flex items-center gap-2">
                            {usingBlob ? (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded px-2 py-1">Blob</span>
                            ) : (
                                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1" title="Falling back to local storage">Offline</span>
                            )}
                            <button
                                disabled={isBackingUp}
                                onClick={async ()=>{
                                    try {
                                        setIsBackingUp(true);
                                        const payload = {
                                            events,
                                            tasks,
                                            groceries,
                                            requests,
                                            exportedAt: new Date().toISOString(),
                                        };
                                        const resp = await fetch('/api/save-backup', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ data: payload })
                                        });
                                        const json = await resp.json();
                                        if (!resp.ok) throw new Error(json?.error || 'Backup failed');
                                        setInfoMessage('Backup saved');
                                    } catch (e) {
                                        setRemoteError(e?.message || 'Backup failed');
                                    } finally {
                                        setIsBackingUp(false);
                                    }
                                }}
                                className={`text-xs rounded px-2 py-1 ${isBackingUp ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                            >{isBackingUp ? 'Backing up…' : 'Backup'}</button>
                            <button
                                disabled={isRestoring}
                                onClick={async ()=>{
                                    try {
                                        setIsRestoring(true);
                                        const resp = await fetch('/api/load-backup');
                                        const json = await resp.json();
                                        if (!resp.ok) throw new Error(json?.error || 'Restore failed');
                                        const d = json?.data || {};
                                        if (Array.isArray(d.events)) setEvents(d.events);
                                        if (Array.isArray(d.tasks)) setTasks(d.tasks);
                                        if (Array.isArray(d.groceries)) setGroceries(d.groceries);
                                        if (Array.isArray(d.requests)) setRequests(d.requests);
                                        setInfoMessage('Backup restored');
                                    } catch (e) {
                                        setRemoteError(e?.message || 'Restore failed');
                                    } finally {
                                        setIsRestoring(false);
                                    }
                                }}
                                className={`text-xs rounded px-2 py-1 ${isRestoring ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                            >{isRestoring ? 'Restoring…' : 'Restore'}</button>
                        </div>
                    </div>
                </div>

                {/* --- Calendar Display --- */}
                {activeTab === 'calendar' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">{monthNames[month]} {year}</h3>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                    <ChevronLeft className="text-gray-600" size={20} />
                                </button>
                                <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                    <ChevronRight className="text-gray-600" size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 text-center font-semibold text-sm text-gray-500">
                            {dayNames.map(day => <div key={day} className="py-2 border-b-2 border-gray-200">{day}</div>)}
                        </div>
                        <div className="grid grid-cols-7 grid-rows-6">
                            {renderCalendar()}
                        </div>
                        {remoteError && (
                            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                                <AlertTriangle size={14} />
                                <span>{remoteError}</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-200 h-fit lg:sticky lg:top-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-800">Tasks</h4>
                            <div className="flex items-center gap-2">
                                <select value={sidebarRecurrence} onChange={(e)=>setSidebarRecurrence(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-[11px]">
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="biweekly">Biweekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                                <span className="text-[10px] text-gray-500">{formatDate(new Date())}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence).length===0 && (
                                <div className="text-xs text-gray-500">No {sidebarRecurrence} tasks.</div>
                            )}
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence).map((t)=>{
                                const todayStr = formatDate(new Date());
                                const checked = isTaskDoneOnDate(t, todayStr);
                                return (
                                    <label key={`side-t-${t.id}`} className="flex items-center gap-2 rounded bg-blue-50 border border-blue-200 px-2 py-2 text-xs">
                                        <input type="checkbox" checked={checked} onChange={()=>toggleTaskDone(t.id, todayStr)} />
                                        <span className={checked ? 'line-through text-gray-500' : 'text-gray-800'}>{t.title}</span>
                                        <button className="ml-auto text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={12}/></button>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
                )}

                {/* Groceries Tab */}
                {activeTab === 'groceries' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Groceries</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                            <input value={groceryName} onChange={(e)=>setGroceryName(e.target.value)} placeholder="Item" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <input value={groceryQty} onChange={(e)=>setGroceryQty(e.target.value)} placeholder="Qty" className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <div className="md:col-span-2" />
                            <button onClick={handleAddGrocery} className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700">Add Item</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {groceries.map((g)=> (
                            <label key={g.id} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                <input type="checkbox" checked={!!g.checked} onChange={()=>toggleGrocery(g.id)} />
                                <div>
                                    <div className={`text-sm font-semibold ${g.checked ? 'line-through text-gray-500' : 'text-gray-800'}`}>{g.name} {g.quantity ? `· ${g.quantity}` : ''}</div>
                                </div>
                                <button className="ml-auto text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1 hover:bg-gray-50" onClick={()=>deleteGrocery(g.id)}><Trash2 size={14}/></button>
                            </label>
                        ))}
                        {groceries.length===0 && <div className="text-xs text-gray-500">No items yet.</div>}
                        {groceries.some((g)=>g.checked) && (
                            <div className="pt-2">
                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 hover:bg-gray-300" onClick={clearCheckedGroceries}>Clear checked</button>
                            </div>
                        )}
                    </div>
                </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-6">
                    <div className="text-xl font-bold text-gray-800">Fiancé Requests</div>
                    <div className="text-xs text-gray-500">Add, approve, or complete requests. Approved requests appear on the calendar (light pink) on their approved date.</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                            <input value={reqFormTitle} onChange={(e)=>setReqFormTitle(e.target.value)} placeholder="Title" className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <select value={reqFormPriority} onChange={(e)=>setReqFormPriority(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg">
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                            <input type="date" value={reqFormDueDate} onChange={(e)=>setReqFormDueDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <input value={reqFormDetails} onChange={(e)=>setReqFormDetails(e.target.value)} placeholder="Details (optional)" className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2" />
                            <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                if (!reqFormTitle.trim()) return;
                                const id = generateId();
                                const payload = {
                                    id,
                                    title: reqFormTitle.trim(),
                                    details: reqFormDetails.trim(),
                                    priority: reqFormPriority,
                                    requestedDueDate: reqFormDueDate ? new Date(reqFormDueDate).toISOString() : null,
                                    approved: false,
                                    approvedDueDate: null,
                                    status: 'pending',
                                };
                                setRequests((prev)=>[...prev, payload]);
                                setReqFormTitle(''); setReqFormDetails(''); setReqFormDueDate(''); setReqFormPriority('medium');
                            }}>Add</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {requests.length === 0 && <div className="text-xs text-gray-500">No requests.</div>}
                        {requests.sort((a,b)=>{
                            const pri = { high: 0, medium: 1, low: 2 };
                            return pri[a.priority]-pri[b.priority];
                        }).map((r)=>(
                            <div key={r.id} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ backgroundColor: '#ffd6e7', border: '1px solid #f5a6bd' }}>
                                <div>
                                    <div className="font-semibold text-[#7a2946]">{r.title}</div>
                                    <div className="text-xs text-[#7a2946]">Priority: <span className="capitalize">{r.priority}</span>{r.requestedDueDate ? ` · requested ${new Date(r.requestedDueDate).toLocaleDateString()}` : ''}{r.approvedDueDate ? ` · approved ${new Date(r.approvedDueDate).toLocaleDateString()}` : ''}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {r.status==='pending' && (
                                        <>
                                            <input type="date" defaultValue={r.requestedDueDate ? formatDate(r.requestedDueDate) : ''} onChange={(e)=>approveRequest(r.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                            <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={()=>approveRequest(r.id, r.requestedDueDate ? formatDate(r.requestedDueDate) : formatDate(new Date()))}>Approve</button>
                                        </>
                                    )}
                                    {r.status!=='completed' && <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={()=>completeRequest(r.id)}>Done</button>}
                                    <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteRequest(r.id)}><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                )}
            </div>

            {/* Floating info toast */}
            {infoMessage && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg">
                    {infoMessage}
                </div>
            )}

            {/* --- Day Details Modal --- */}
            {selectedDayStr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 p-4" onClick={() => setSelectedDayStr(null)}>
                    <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h4 className="text-lg font-bold text-gray-800">Details for {new Date(selectedDayStr).toLocaleDateString()}</h4>
                            <button className="p-2 rounded hover:bg-gray-100" onClick={() => setSelectedDayStr(null)} aria-label="Close">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Quick add for this day */}
                            <div className="grid grid-cols-1 gap-3">
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    <div className="text-xs font-semibold text-gray-700 mb-2">Add to this day</div>
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <select value={newItemType} onChange={(e)=>setNewItemType(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs w-28">
                                            <option value="task">Task</option>
                                            <option value="event">Event</option>
                                        </select>
                                        {newItemType==='task' && (
                                            <select value={newTaskRecurrence} onChange={(e)=>setNewTaskRecurrence(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs w-28">
                                                <option value="none">One-time</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="biweekly">Biweekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                        )}
                                        <input value={newItemTitle} onChange={(e)=>setNewItemTitle(e.target.value)} placeholder={newItemType==='task' ? 'Task title' : 'Event title'} className="flex-1 min-w-[160px] px-2 py-1 border border-gray-300 rounded text-sm" />
                                        <button className="text-xs bg-blue-600 text-white rounded px-3 py-1 hover:bg-blue-700" onClick={()=>{
                                            if (newItemType==='task') { addTaskForDay(selectedDayStr, newItemTitle, newTaskRecurrence); }
                                            else { addEventForDay(selectedDayStr, newItemTitle); }
                                            setNewItemTitle('');
                                        }}>Add</button>
                                    </div>
                                </div>
                            </div>

                            {/* Lists for this day */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <div className="text-sm font-semibold text-gray-700 mb-2">Events</div>
                                    {events.filter(e=>e.date===selectedDayStr).length===0 ? <p className="text-xs text-gray-500">No events.</p> : (
                                        <div className="space-y-2">
                                            {events.filter(e=>e.date===selectedDayStr).map((ev)=>(
                                                <div key={`dlg-ev-${ev.id}`} className="rounded bg-purple-100 border border-purple-200 px-3 py-2 text-sm">
                                                    {editingEventId===ev.id ? (
                                                        <div className="space-y-2">
                                                            <input value={editEventTitle} onChange={(e)=>setEditEventTitle(e.target.value)} className="w-full px-2 py-1 border border-purple-300 rounded text-sm" />
                                                            <textarea value={editEventNotes} onChange={(e)=>setEditEventNotes(e.target.value)} rows={2} className="w-full px-2 py-1 border border-purple-300 rounded text-xs" placeholder="Notes" />
                                                            <div className="flex justify-end gap-2">
                                                                <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                    setEvents(prev=>prev.map(x=> x.id===ev.id ? { ...x, title: editEventTitle.trim()||x.title, notes: editEventNotes } : x));
                                                                    setEditingEventId(null); setEditEventTitle(''); setEditEventNotes('');
                                                                }}>Save</button>
                                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingEventId(null); setEditEventTitle(''); setEditEventNotes(''); }}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-1">
                                                                <div className="font-semibold text-gray-800">{ev.title}</div>
                                                                {ev.notes && <div className="text-xs text-gray-600 whitespace-pre-wrap">{ev.notes}</div>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingEventId(ev.id); setEditEventTitle(ev.title); setEditEventNotes(ev.notes||''); }}>Edit</button>
                                                                <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteEvent(ev.id)}><Trash2 size={14}/></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-700 mb-2">Tasks</div>
                                    {tasks.filter(t=>occursOnDay(t, new Date(selectedDayStr))).length===0 ? <p className="text-xs text-gray-500">No tasks.</p> : (
                                        <div className="space-y-2">
                                            {tasks.filter(t=>occursOnDay(t, new Date(selectedDayStr))).map((t)=>(
                                                <div key={`dlg-t-${t.id}`} className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-sm">
                                                    {editingTaskId===t.id ? (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <input type="checkbox" checked={isTaskDoneOnDate(t, selectedDayStr)} onChange={()=>toggleTaskDone(t.id, selectedDayStr)} />
                                                                <input value={editTaskTitle} onChange={(e)=>setEditTaskTitle(e.target.value)} className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm" />
                                                                <select value={t.recurrence} onChange={(e)=> setTasks(prev=>prev.map(x=> x.id===t.id ? { ...x, recurrence: e.target.value } : x))} className="px-2 py-1 border border-blue-300 rounded text-xs">
                                                                    <option value="none">One-time</option>
                                                                    <option value="daily">Daily</option>
                                                                    <option value="weekly">Weekly</option>
                                                                    <option value="biweekly">Biweekly</option>
                                                                    <option value="monthly">Monthly</option>
                                                                </select>
                                                            </div>
                                                            <textarea value={editTaskNotes} onChange={(e)=>setEditTaskNotes(e.target.value)} rows={2} className="w-full px-2 py-1 border border-blue-300 rounded text-xs" placeholder="Notes" />
                                                            <div className="flex justify-end gap-2">
                                                                <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{ setTasks(prev=>prev.map(x=> x.id===t.id ? { ...x, title: (editTaskTitle.trim()||x.title), notes: editTaskNotes } : x)); setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes(''); }}>Save</button>
                                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes(''); }}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-2">
                                                            <input type="checkbox" checked={isTaskDoneOnDate(t, selectedDayStr)} onChange={()=>toggleTaskDone(t.id, selectedDayStr)} />
                                                            <div className="flex-1">
                                                                <div className={isTaskDoneOnDate(t, selectedDayStr) ? 'line-through text-gray-500' : 'text-gray-800'}>{t.title} {t.recurrence && t.recurrence!=='none' && <span className="text-xs text-gray-500">({t.recurrence})</span>}</div>
                                                                {t.notes && <div className="text-xs text-gray-600 whitespace-pre-wrap">{t.notes}</div>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingTaskId(t.id); setEditTaskTitle(t.title); setEditTaskNotes(t.notes||''); }}>Edit</button>
                                                                <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={14}/></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-gray-700 mb-2">Requests</div>
                                    {requests.filter(r=>r.status==='approved' && r.approvedDueDate && formatDate(r.approvedDueDate)===selectedDayStr).length===0 ? <p className="text-xs text-gray-500">No requests.</p> : (
                                        <div className="space-y-1">
                                            {requests.filter(r=>r.status==='approved' && r.approvedDueDate && formatDate(r.approvedDueDate)===selectedDayStr).map((r)=>(
                                                <div key={`dlg-rq-${r.id}`} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ backgroundColor: '#ffd6e7', border: '1px solid #f5a6bd' }}>
                                                    <span className="text-[#7a2946]">{r.title} <span className="capitalize text-xs">({r.priority})</span></span>
                                                    <div className="flex items-center gap-2">
                                                        {r.status!=='completed' && <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={()=>completeRequest(r.id)}>Done</button>}
                                                        <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteRequest(r.id)}><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
