import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, AlertTriangle, X, Trash2, CalendarDays, ShoppingCart, Star, Briefcase, Clipboard, Sun, Moon, Upload, User } from 'lucide-react';

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

    // Auth / User & global filters
    const [currentUser, setCurrentUser] = useState(null);
    const isHeather = currentUser === 'Heather';
    const isAccountManager = currentUser === 'AccountManager';
    const isRestrictedViewer = isHeather || isAccountManager;
    const [ownerFilter, setOwnerFilter] = useState('all'); // 'all' | 'Nick' | 'MP'
    const [mode, setMode] = useState('work'); // 'work' | 'home'
    const [theme, setTheme] = useState('light');
    const [calendarTypeFilter, setCalendarTypeFilter] = useState('work'); // 'work' | 'home' | 'all'
    const [calendarVisibility, setCalendarVisibility] = useState({ Nick: { work: true, personal: true }, MP: { work: true, personal: true } });

    // Collections
    const [tasks, setTasks] = useState([]);      // {id, title, date(YYYY-MM-DD), done, recurrence}
    const [events, setEvents] = useState([]);    // {id, title, date(YYYY-MM-DD), type('work'|'personal'), owner}
    const [groceries, setGroceries] = useState([]); // {id, name, quantity, checked}
    const [requests, setRequests] = useState([]);   // {id, title, details, priority, requestedDueDate, approved, approvedDueDate, status}
    const [afterWorkPlans, setAfterWorkPlans] = useState([]); // {id, date(YYYY-MM-DD), title, start(HH:MM), end(HH:MM)}
    const [trips, setTrips] = useState([]); // {id, title, startDate, endDate, items:[{id,time,title,place:{placeId,name,address,location}}]}

    // Inputs (day modal)
    const [newItemType, setNewItemType] = useState('task'); // 'task' | 'event'
    const [newItemTitle, setNewItemTitle] = useState('');
    const [newTaskRecurrence, setNewTaskRecurrence] = useState('none'); // none | daily | weekly | biweekly | monthly
    const [newTaskType, setNewTaskType] = useState('personal'); // personal | work
    const [newEventType, setNewEventType] = useState('work'); // personal | work
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
    // Account Manager request form
    const [amName, setAmName] = useState('');
    const [amTitle, setAmTitle] = useState('');
    const [amPriority, setAmPriority] = useState('medium');
    const [amDueDate, setAmDueDate] = useState('');
    const [amDetails, setAmDetails] = useState('');

    // Boss requests (work)
    const [bossReqTitle, setBossReqTitle] = useState('');
    const [bossReqPriority, setBossReqPriority] = useState('medium');
    const [bossReqDueDate, setBossReqDueDate] = useState('');
    const [bossReqDetails, setBossReqDetails] = useState('');

    // Sidebar filter
    const [sidebarRecurrence, setSidebarRecurrence] = useState('daily'); // daily | weekly | biweekly | monthly

    // Inline editing state for modal items
    const [editingTaskId, setEditingTaskId] = useState(null);
    const [editTaskTitle, setEditTaskTitle] = useState('');
    const [editTaskNotes, setEditTaskNotes] = useState('');
    const [editingEventId, setEditingEventId] = useState(null);
    const [editEventTitle, setEditEventTitle] = useState('');
    const [editEventNotes, setEditEventNotes] = useState('');

    // Work tab notes modal
    const [workNotesTaskId, setWorkNotesTaskId] = useState(null);
    const [workNotesDraft, setWorkNotesDraft] = useState('');
    // Work tab subtask notes modal
    const [workSubNotesTaskId, setWorkSubNotesTaskId] = useState(null);
    const [workSubNotesSubId, setWorkSubNotesSubId] = useState(null);
    const [workSubNotesDraft, setWorkSubNotesDraft] = useState('');
    // Work tab new subtask input state per task
    const [newSubTitleByTask, setNewSubTitleByTask] = useState({});

    // Request edit modal state
    const [requestEditId, setRequestEditId] = useState(null);
    const [requestEdit, setRequestEdit] = useState({ title: '', details: '', priority: 'medium', submittedBy: '', dueDate: '' });
    const openRequestEditor = (req) => {
        const due = req.status === 'approved' ? (req.approvedDueDate || req.requestedDueDate) : req.requestedDueDate;
        setRequestEditId(req.id);
        setRequestEdit({
            title: req.title || '',
            details: req.details || '',
            priority: req.priority || 'medium',
            submittedBy: req.submittedBy || '',
            dueDate: due ? formatDate(due) : '',
        });
    };
    const closeRequestEditor = () => { setRequestEditId(null); };
    const saveRequestEditor = () => {
        const r = (requests || []).find(x => x.id === requestEditId);
        if (!r) { setRequestEditId(null); return; }
        const updates = {
            title: (requestEdit.title || '').trim(),
            details: (requestEdit.details || '').trim(),
            priority: requestEdit.priority || 'medium',
            submittedBy: (requestEdit.submittedBy || '').trim() || undefined,
        };
        if (requestEdit.dueDate) {
            const iso = new Date(requestEdit.dueDate).toISOString();
            if (r.status === 'approved') updates.approvedDueDate = iso;
            else updates.requestedDueDate = iso;
        }
        updateRequest(r.id, updates);
        // ensure persistence immediately
        const next = (requests || []).map((x)=> x.id===r.id ? { ...x, ...updates } : x);
        saveStateImmediate({ requests: next });
        setRequestEditId(null);
    };

    // Meals / Meal Planner
    const [meals, setMeals] = useState([]); // {id,title,recipe,link,ingredients:[{id,name,quantity}], fileUrl?, owner}
    const [groceriesSubtab, setGroceriesSubtab] = useState('list'); // list | planner
    // New meal form
    const [mealTitle, setMealTitle] = useState('');
    const [mealRecipe, setMealRecipe] = useState('');
    const [mealLink, setMealLink] = useState('');
    const [mealIngredients, setMealIngredients] = useState([]);
    const [ingName, setIngName] = useState('');
    const [ingQty, setIngQty] = useState('');
    // Planner week and selections
    const [plannerWeekStart, setPlannerWeekStart] = useState(formatDate(new Date()));
    const [plannerSelection, setPlannerSelection] = useState({}); // {0..6: mealId}

    // Meal file attachment
    const [mealFileUrl, setMealFileUrl] = useState('');

    // Work files
    const [workFiles, setWorkFiles] = useState([]); // {id,title,url,owner,uploadedAt}

    // After work planner inputs
    const [awpDate, setAwpDate] = useState(formatDate(new Date()));
    const [awpTitle, setAwpTitle] = useState('');
    const [awpStart, setAwpStart] = useState('16:00');
    const [awpEnd, setAwpEnd] = useState('17:00');

    // Trip planner inputs
    const [tripTitle, setTripTitle] = useState('');
    const [tripStart, setTripStart] = useState('');
    const [tripEnd, setTripEnd] = useState('');
    const [activeTripId, setActiveTripId] = useState(null);
    const [tripItemTitle, setTripItemTitle] = useState('');
    const [tripItemTime, setTripItemTime] = useState('');
    const [placeQuery, setPlaceQuery] = useState('');
    const [placeResults, setPlaceResults] = useState([]);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const placesTimerRef = useRef(null);
    const [travelMode, setTravelMode] = useState('driving');

    const updateActiveTrip = (updater) => {
        setTrips((prev) => prev.map((t) => t.id === activeTripId ? updater(t) : t));
    };
    const moveTripItem = (tripId, itemId, dir) => {
        setTrips((prev) => prev.map((t) => {
            if (t.id !== tripId) return t;
            const items = Array.isArray(t.items) ? [...t.items] : [];
            const idx = items.findIndex((x) => x.id === itemId);
            if (idx < 0) return t;
            const swapWith = dir === 'up' ? idx - 1 : idx + 1;
            if (swapWith < 0 || swapWith >= items.length) return t;
            const tmp = items[idx];
            items[idx] = items[swapWith];
            items[swapWith] = tmp;
            return { ...t, items };
        }));
    };

    // Google Calendar integration state
    const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
    const [googleAccessToken, setGoogleAccessToken] = useState(null);
    const [googleTokenExpiresAt, setGoogleTokenExpiresAt] = useState(null);
    const [googleAuthorized, setGoogleAuthorized] = useState(false);
    const [googleCalendars, setGoogleCalendars] = useState([]); // {id, summary, primary}
    const [googleWorkCalendarId, setGoogleWorkCalendarId] = useState(() => {
        try { return localStorage.getItem('googleWorkCalendarId') || ''; } catch (_) { return ''; }
    });
    const [googleHomeCalendarId, setGoogleHomeCalendarId] = useState(() => {
        try { return localStorage.getItem('googleHomeCalendarId') || ''; } catch (_) { return ''; }
    });
    const [googleSyncBusy, setGoogleSyncBusy] = useState(false);
    const isSyncingFromGoogleRef = useRef(false);

    // Persist selected calendar choices
    useEffect(() => {}, [googleWorkCalendarId]);
    useEffect(() => {}, [googleHomeCalendarId]);

    // Sync mode to active tab
    useEffect(() => {
        setActiveTab(mode === 'work' ? 'work' : 'home');
    }, [mode]);

    // Backup/Restore in-progress state
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Sync theme with document root
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    }, [theme]);

    useEffect(() => {}, [calendarVisibility]);

    useEffect(() => {
        // default calendar filter according to mode
        setCalendarTypeFilter(mode==='work' ? 'work' : 'home');
    }, [mode]);

    useEffect(() => {}, [currentUser]);

    // Restrict Heather and Account Manager views
    useEffect(() => {
        if (currentUser === 'Heather') {
            if (mode !== 'work') setMode('work');
            setActiveTab((prev) => (prev === 'calendar' || prev === 'requests') ? prev : 'requests');
            if (ownerFilter !== 'Nick') setOwnerFilter('Nick');
            if (calendarTypeFilter !== 'work') setCalendarTypeFilter('work');
            setCalendarVisibility({ Nick: { work: true, personal: false }, MP: { work: false, personal: false } });
        }
        if (currentUser === 'AccountManager') {
            if (mode !== 'work') setMode('work');
            if (activeTab !== 'requests') setActiveTab('requests');
            if (ownerFilter !== 'Nick') setOwnerFilter('Nick');
            if (calendarTypeFilter !== 'work') setCalendarTypeFilter('work');
            setCalendarVisibility({ Nick: { work: true, personal: false }, MP: { work: false, personal: false } });
        }
    }, [currentUser, mode, ownerFilter, calendarTypeFilter, activeTab]);

    useEffect(() => {}, []);

    const addDaysToYmd = (ymd, days) => {
        if (!ymd) return ymd;
        const [y, m, d] = ymd.split('-').map((x) => Number(x));
        const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
        dt.setUTCDate(dt.getUTCDate() + (days || 0));
        const yyyy = dt.getUTCFullYear();
        const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(dt.getUTCDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const ensureGoogleToken = async () => {
        if (!GOOGLE_CLIENT_ID) {
            setRemoteError('Missing REACT_APP_GOOGLE_CLIENT_ID env var for Google Calendar.');
            throw new Error('Missing Google Client ID');
        }
        if (googleAccessToken && googleTokenExpiresAt && Date.now() < googleTokenExpiresAt - 30_000) {
            return googleAccessToken;
        }
        // Request a new access token using Google Identity Services
        await new Promise((resolve, reject) => {
            try {
                const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: 'https://www.googleapis.com/auth/calendar',
                    callback: (resp) => {
                        if (resp && resp.access_token) {
                            const expiresInSec = Number(resp.expires_in || 3600);
                            const expAt = Date.now() + expiresInSec * 1000;
                            setGoogleAccessToken(resp.access_token);
                            setGoogleTokenExpiresAt(expAt);
                            setGoogleAuthorized(true);
                            try { localStorage.setItem('googleAccessToken', resp.access_token); } catch (_) {}
                            try { localStorage.setItem('googleTokenExpiresAt', String(expAt)); } catch (_) {}
                            resolve();
                        } else {
                            reject(new Error('Failed to authorize with Google'));
                        }
                    },
                });
                tokenClient.requestAccessToken({ prompt: googleAuthorized ? '' : 'consent' });
            } catch (e) {
                reject(e);
            }
        });
        return googleAccessToken;
    };

    const googleApiFetch = async (path, options = {}) => {
        const token = await ensureGoogleToken();
        const url = `https://www.googleapis.com/calendar/v3${path}`;
        const resp = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(options.headers || {}),
            },
        });
        if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(text || `Google API error ${resp.status}`);
        }
        return resp.json();
    };

    const listGoogleCalendars = async () => {
        try {
            setGoogleSyncBusy(true);
            const json = await googleApiFetch('/users/me/calendarList');
            const items = Array.isArray(json?.items) ? json.items : [];
            const mapped = items.map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary }));
            setGoogleCalendars(mapped);
        } catch (e) {
            setRemoteError(e?.message || 'Failed to list Google calendars');
        } finally {
            setGoogleSyncBusy(false);
        }
    };

    // Immediate save helper to persist state changes without waiting for debounce
    const saveStateImmediate = async (overrides = {}) => {
        try {
            if (!usingBlob) return;
            const nowIso = new Date().toISOString();
            const body = {
                events,
                tasks,
                groceries,
                requests,
                meals,
                workFiles,
                trips,
                afterWorkPlans,
                savedAt: nowIso,
                ...overrides,
            };
            await fetch('/api/state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        } catch (_) {
            // swallow; debounced saver will retry
        }
    };

    const importFromGoogle = async () => {
        if (!googleWorkCalendarId && !googleHomeCalendarId) return;
        try {
            setGoogleSyncBusy(true);
            isSyncingFromGoogleRef.current = true;
            const timeMin = new Date();
            timeMin.setUTCFullYear(timeMin.getUTCFullYear() - 1);
            const timeMax = new Date();
            timeMax.setUTCFullYear(timeMax.getUTCFullYear() + 1);
            const isoMin = timeMin.toISOString();
            const isoMax = timeMax.toISOString();

            const fetchEvents = async (calendarId, typeLabel) => {
                if (!calendarId) return [];
                const q = new URLSearchParams({
                    singleEvents: 'true',
                    orderBy: 'startTime',
                    timeMin: isoMin,
                    timeMax: isoMax,
                    maxResults: '2500',
                }).toString();
                const json = await googleApiFetch(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
                const items = Array.isArray(json?.items) ? json.items : [];
                return items
                    .filter((ev) => ev?.status !== 'cancelled')
                    .map((ev) => {
                        const start = ev.start?.date || ev.start?.dateTime;
                        const ymd = ev.start?.date ? ev.start.date : formatDate(ev.start?.dateTime || ev.start);
                        return {
                            googleEventId: ev.id,
                            googleCalendarId: calendarId,
                            title: ev.summary || '(no title)',
                            date: ymd,
                            notes: ev.description || '',
                            type: typeLabel,
                        };
                    });
            };

            const [workItems, homeItems] = await Promise.all([
                fetchEvents(googleWorkCalendarId, 'work'),
                fetchEvents(googleHomeCalendarId, 'personal'),
            ]);
            const incoming = [...workItems, ...homeItems];
            if (incoming.length === 0) return;

            setEvents((prev) => {
                const byGoogleId = new Map(prev.filter((e) => e.googleEventId).map((e) => [e.googleEventId, e]));
                const next = [...prev];
                incoming.forEach((inc) => {
                    const existing = byGoogleId.get(inc.googleEventId);
                    if (existing) {
                        // Update fields if changed
                        if (existing.title !== inc.title || existing.date !== inc.date || (existing.notes||'') !== (inc.notes||'')) {
                            const idx = next.findIndex((x) => x.id === existing.id);
                            if (idx >= 0) next[idx] = { ...existing, title: inc.title, date: inc.date, notes: inc.notes, type: inc.type, owner: existing.owner || (currentUser || 'Nick') };
                        }
                    } else {
                        next.push({ id: generateId(), title: inc.title, date: inc.date, notes: inc.notes, type: inc.type, owner: currentUser || 'Nick', googleEventId: inc.googleEventId, googleCalendarId: inc.googleCalendarId });
                    }
                });
                return next;
            });
        } catch (e) {
            setRemoteError(e?.message || 'Failed to import from Google');
        } finally {
            isSyncingFromGoogleRef.current = false;
            setGoogleSyncBusy(false);
        }
    };

    const exportToGoogle = async () => {
        try {
            setGoogleSyncBusy(true);
            await ensureGoogleToken();
            const all = Array.isArray(events) ? events : [];
            const targetable = all.filter((e) => (e.type === 'work' ? !!googleWorkCalendarId : e.type === 'personal' ? !!googleHomeCalendarId : false));

            for (const ev of targetable) {
                const calendarId = ev.type === 'work' ? googleWorkCalendarId : googleHomeCalendarId;
                const resource = {
                    summary: ev.title || '',
                    description: ev.notes || '',
                    start: { date: ev.date },
                    end: { date: addDaysToYmd(ev.date, 1) },
                };
                try {
                    if (ev.googleEventId && ev.googleCalendarId === calendarId) {
                        await googleApiFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(ev.googleEventId)}`, {
                            method: 'PATCH',
                            body: JSON.stringify(resource),
                        });
                    } else if (!ev.googleEventId) {
                        const created = await googleApiFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
                            method: 'POST',
                            body: JSON.stringify(resource),
                        });
                        const newGoogleId = created?.id;
                        if (newGoogleId) {
                            setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, googleEventId: newGoogleId, googleCalendarId: calendarId } : x)));
                        }
                    } else if (ev.googleEventId && ev.googleCalendarId && ev.googleCalendarId !== calendarId) {
                        // Move between calendars: delete then create
                        try {
                            await googleApiFetch(`/calendars/${encodeURIComponent(ev.googleCalendarId)}/events/${encodeURIComponent(ev.googleEventId)}`, { method: 'DELETE' });
                        } catch (_) {}
                        const created = await googleApiFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(resource) });
                        const newGoogleId = created?.id;
                        if (newGoogleId) {
                            setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, googleEventId: newGoogleId, googleCalendarId: calendarId } : x)));
                        }
                    }
                } catch (err) {
                    // Continue with others, but surface one error
                    setRemoteError(err?.message || 'Failed to sync some events to Google');
                }
            }
        } catch (e) {
            setRemoteError(e?.message || 'Failed to export to Google');
        } finally {
            setGoogleSyncBusy(false);
        }
    };

    // Load state from Blob
    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch('/api/state');
                if (!resp.ok) throw new Error('Failed to load state');
                    const json = await resp.json();
                    const d = json?.data || {};
                    setUsingBlob(true);
                if (Array.isArray(d.events)) setEvents(d.events);
                if (Array.isArray(d.tasks)) setTasks(d.tasks);
                if (Array.isArray(d.groceries)) setGroceries(d.groceries);
                if (Array.isArray(d.requests)) setRequests(d.requests);
                if (Array.isArray(d.meals)) setMeals(d.meals);
                if (Array.isArray(d.workFiles)) setWorkFiles(d.workFiles);
                if (Array.isArray(d.trips)) setTrips(d.trips);
                if (Array.isArray(d.afterWorkPlans)) setAfterWorkPlans(d.afterWorkPlans);
            } catch (e) {
                setRemoteError(e?.message || 'Failed to load state');
            }
        })();
    }, []);

    // Persist to Blob (debounced)
    useEffect(() => {
        const save = setTimeout(async () => {
            const nowIso = new Date().toISOString();
            if (usingBlob) {
                try {
                    await fetch('/api/state', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            events,
                            tasks,
                            groceries,
                            requests,
                            meals,
                            workFiles,
                            trips,
                            afterWorkPlans,
                            savedAt: nowIso,
                        }),
                    });
                } catch (_) {
                    setRemoteError('Failed to save state');
                }
            }
        }, 400);
        return () => clearTimeout(save);
    }, [events, tasks, groceries, requests, meals, workFiles, trips, afterWorkPlans, usingBlob]);

    // Removed localStorage caching of collections to ensure cross-instance consistency

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
    const appliesOwnerFilter = (owner) => ownerFilter === 'all' || owner === ownerFilter;
    const updateRequest = (requestId, updates) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, ...updates } : r));
    };
    const denyRequest = (requestId) => {
        setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'denied', approved: false } : r));
    };
    const parseYmd = (ymd) => {
        if (!ymd) return new Date();
        const parts = String(ymd).split('-').map((p) => parseInt(p, 10));
        if (parts.length === 3 && !parts.some(isNaN)) {
            return new Date(parts[0], parts[1]-1, parts[2]);
        }
        const d = new Date(ymd);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // Tasks (as checklist items themselves)
    const addTaskForDay = (dayStr, title, recurrence = 'none', type = 'personal') => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        const owner = currentUser || 'Nick';
        setTasks((prev) => [...prev, { id, title: trimmed, date: dayStr, completedDates: [], recurrence, notes: '', type, priority: type==='work' ? 2 : null, estimate: type==='work' ? '' : null, subtasks: [], owner }]);
    };
    const addSubtask = (taskId, title) => {
        const trimmed = (title || '').trim();
        if (!trimmed) return;
        const subId = generateId();
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const subtasks = Array.isArray(t.subtasks) ? [...t.subtasks] : [];
            subtasks.push({ id: subId, title: trimmed, notes: '', completedDates: [] });
            return { ...t, subtasks };
        }));
    };
    const toggleSubtaskDone = (taskId, subId, dayStr) => {
        setTasks((prev) => prev.map((t) => {
            if (t.id !== taskId) return t;
            const subtasks = (t.subtasks || []).map((s) => {
                if (s.id !== subId) return s;
                const list = Array.isArray(s.completedDates) ? [...s.completedDates] : [];
                const idx = list.indexOf(dayStr);
                if (idx >= 0) list.splice(idx, 1); else list.push(dayStr);
                return { ...s, completedDates: list };
            });
            return { ...t, subtasks };
        }));
    };
    const deleteSubtask = (taskId, subId) => {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, subtasks: (t.subtasks || []).filter((s) => s.id !== subId) } : t));
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
    const addEventForDay = (dayStr, title, type = 'work') => {
        const trimmed = title.trim();
        if (!trimmed) return;
        const id = generateId();
        const owner = currentUser || 'Nick';
        setEvents((prev) => [...prev, { id, title: trimmed, date: dayStr, notes: '', type, owner }]);
    };
    const deleteEvent = async (eventId) => {
        const target = (events || []).find((e) => e.id === eventId);
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        if (target && target.googleEventId && target.googleCalendarId) {
            try {
                await googleApiFetch(`/calendars/${encodeURIComponent(target.googleCalendarId)}/events/${encodeURIComponent(target.googleEventId)}`, { method: 'DELETE' });
            } catch (_) {
                // Ignore failure; local deletion already applied
            }
        }
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
    const handleAddRequest = (dueDayStr, title, priority, details, source = 'fiance') => {
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
            source,
            owner: currentUser || 'Nick',
        };
        setRequests((prev) => [...prev, payload]);
        setNewRequestTitle('');
        setRequestDetails('');
        setNewRequestPriority('medium');
    };
    const handleAddAccountManagerRequest = () => {
        const t = (amTitle || '').trim();
        const n = (amName || '').trim();
        if (!t || !amDueDate) return;
        const id = generateId();
        const payload = {
            id,
            title: t,
            details: (amDetails || '').trim(),
            priority: amPriority,
            requestedDueDate: new Date(amDueDate).toISOString(),
            approved: false,
            approvedDueDate: null,
            status: 'pending',
            source: 'account_manager',
            submittedBy: n || 'Account Manager',
            owner: 'Nick',
        };
        setRequests((prev) => [...prev, payload]);
        // Persist immediately so Heather sees it and refresh keeps it
        saveStateImmediate({ requests: [...requests, payload] });
        setAmTitle(''); setAmDetails(''); setAmDueDate(''); setAmPriority('medium'); setAmName('');
    };
    const approveRequest = (requestId, newDueDateStr) => {
        const next = (requests || []).map((r) => r.id === requestId ? { ...r, approved: true, status: 'approved', approvedDueDate: newDueDateStr ? new Date(newDueDateStr).toISOString() : (r.requestedDueDate || null) } : r);
        setRequests(next);
        saveStateImmediate({ requests: next });
    };
    const completeRequest = (requestId) => {
        const next = (requests || []).map((r) => r.id === requestId ? { ...r, status: 'completed' } : r);
        setRequests(next);
        saveStateImmediate({ requests: next });
    };
    const deleteRequest = (requestId) => {
        const next = (requests || []).filter((r) => r.id !== requestId);
        setRequests(next);
        saveStateImmediate({ requests: next });
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

            const allowsType = (type) => calendarTypeFilter==='all' || (calendarTypeFilter==='work' ? (type||'personal')==='work' : (type||'personal')==='personal');
            const allowsOwnerType = (owner, type) => !!(calendarVisibility?.[owner]?.[type==='work'?'work':'personal']);
            const tasksOccurring = tasks.filter(t => t.recurrence !== 'daily' && occursOnDay(t, dayDate) && appliesOwnerFilter(t.owner) && allowsType(t.type||'personal') && allowsOwnerType(t.owner || 'Nick', (t.type||'personal')));
            // Only carry to the immediate next day, and only once the previous day has ended
            const prevDate = new Date(dayDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevStr = formatDate(prevDate);
            const showOverdue = prevStr < todayStr; // don't carry from today to tomorrow until day ends
            const overdue = showOverdue ? tasks.filter(t =>
                appliesOwnerFilter(t.owner)
                && allowsType(t.type||'personal')
                && allowsOwnerType(t.owner || 'Nick', (t.type||'personal'))
                && occursOnDay(t, prevDate)
                && !isTaskDoneOnDate(t, prevStr)
            ) : [];
            const tasksToday = tasksOccurring.filter(t => !overdue.includes(t));
            const eventsToday = events.filter(e => e.date === dayStr && appliesOwnerFilter(e.owner) && allowsType(e.type||'personal') && allowsOwnerType(e.owner || 'Nick', (e.type||'personal')));
            const requestsToday = requests.filter(r => r.status === 'approved' && r.approvedDueDate && formatDate(r.approvedDueDate) === dayStr);

            calendarDays.push(
                <div
                    key={dayStr}
                    className={dayClasses + " cursor-pointer hover:bg-gray-50"}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDayStr(dayStr)}
                    onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') setSelectedDayStr(dayStr); }}
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
                        {overdue.length>0 && (
                            <div className="w-full text-[10px] rounded-lg border border-red-300 bg-red-50 text-red-700 px-1.5 py-0.5 font-semibold">OVERDUE</div>
                        )}
                        {overdue.map((t) => (
                            <div key={`t-overdue-${t.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate flex items-center gap-1" style={{ backgroundColor: '#ef4444' }}>
                                <span className={`truncate ${isTaskDoneOnDate(t, dayStr) ? 'line-through' : ''}`}>{t.title}</span>
                                {t.recurrence && t.recurrence !== 'none' && <span className="ml-1 opacity-80">({t.recurrence})</span>}
                                {!isHeather && <button className="ml-auto hover:bg-white/10 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteTask(t.id); }}><Trash2 size={12} /></button>}
                            </div>
                        ))}
                        {overdue.length>0 && (
                            <div className="w-full text-[10px] rounded-lg border border-red-300 bg-red-50 text-red-700 px-1.5 py-0.5 font-semibold">OVERDUE</div>
                        )}
                        {overdue.map((t) => (
                            <div key={`t-overdue-${t.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate flex items-center gap-1" style={{ backgroundColor: '#ef4444' }}>
                                <span className={`truncate ${isTaskDoneOnDate(t, dayStr) ? 'line-through' : ''}`}>{t.title}</span>
                                {t.recurrence && t.recurrence !== 'none' && <span className="ml-1 opacity-80">({t.recurrence})</span>}
                                <button className="ml-auto hover:bg-white/10 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteTask(t.id); }}><Trash2 size={12} /></button>
                            </div>
                        ))}
                        {tasksToday.map((t) => (
                            <div key={`t-${t.id}`} className="w-full text-[10px] text-white rounded-lg shadow px-1.5 py-0.5 truncate flex items-center gap-1" style={{ backgroundColor: (t.type||'personal')==='work' ? '#f59e0b' : '#3b82f6' }}>
                                <span className={`truncate ${isTaskDoneOnDate(t, dayStr) ? 'line-through' : ''}`}>{t.title}</span>
                                {t.recurrence && t.recurrence !== 'none' && <span className="ml-1 opacity-80">({t.recurrence})</span>}
                                <button className="ml-auto hover:bg-white/10 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteTask(t.id); }}><Trash2 size={12} /></button>
                                    </div>
                        ))}
                        {requestsToday.map((r) => (
                            <div key={`rq-${r.id}`} className="w-full text-[10px] rounded-lg shadow px-1.5 py-0.5 truncate" style={{ backgroundColor: '#ffd6e7', color: '#7a2946' }} title={`${r.title} (${r.priority})`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-medium truncate">{r.title}</span>
                                    {!isHeather && <button className="hover:bg-black/5 rounded p-0.5" onClick={(e)=>{ e.stopPropagation(); deleteRequest(r.id); }}><Trash2 size={12} /></button>}
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
        <div className="bg-gray-50 dark:bg-gray-950 min-h-screen flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-7xl mx-auto space-y-4">

                {/* Login screen */}
                {!currentUser && (
                    <div className="w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 text-center">
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Select User</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">Choose who is using the app</div>
                        <div className="flex items-center justify-center gap-3">
                            <button className="px-4 py-2 rounded-lg bg-blue-600 text-white" onClick={()=> setCurrentUser('Nick')}>Nick</button>
                            <button className="px-4 py-2 rounded-lg bg-gray-800 text-white" onClick={()=> setCurrentUser('MP')}>MP</button>
                            <button className="px-4 py-2 rounded-lg bg-amber-600 text-white" onClick={()=> setCurrentUser('Heather')}>Heather</button>
                            <button className="px-4 py-2 rounded-lg bg-purple-700 text-white" onClick={()=> setCurrentUser('AccountManager')}>Account Manager</button>
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs">
                            <span className="text-gray-600 dark:text-gray-300">Theme</span>
                            <button onClick={()=> setTheme(theme==='light'?'dark':'light')} className="p-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                                {theme==='light'? <Moon size={14} /> : <Sun size={14} />}
                            </button>
                        </div>
                    </div>
                )}
                {currentUser && (
                <>
                {/* Top banner with mode toggle (centered) */}
                <div className="flex items-center justify-center">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={()=> setMode('work')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode==='work' ? 'bg-amber-600 text-white' : 'bg-white text-gray-800 border border-gray-300'}`}>Work</button>
                        {!isHeather && (
                            <button onClick={()=> setMode('home')} className={`px-4 py-2 rounded-lg text-sm font-semibold ${mode==='home' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border border-gray-300'}`}>Home</button>
                        )}
                    </div>
                </div>

                {/* Tabs: distinct per mode */}
                {mode==='work' ? (
                <div className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2 items-center">
                        {!isAccountManager && (
                            <button onClick={() => setActiveTab('calendar')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><CalendarDays size={16} /> Calendar</button>
                        )}
                        <button onClick={() => setActiveTab('requests')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Star size={16} /> Requests</button>
                        {!(isHeather || isAccountManager) && (
                            <>
                                <button onClick={() => setActiveTab('work')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='work' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Briefcase size={16} /> Tasks</button>
                                <button onClick={() => setActiveTab('afterwork')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='afterwork' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Clipboard size={16} /> After work planner</button>
                            </>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                            {/* Google Calendar controls */}
                            {!(isHeather || isAccountManager) && (
                                <div className="flex items-center gap-2">
                                    {!googleAuthorized ? (
                                        <button
                                            onClick={async ()=>{ try { await ensureGoogleToken(); await listGoogleCalendars(); } catch(_){} }}
                                            className="text-xs rounded px-2 py-1 bg-green-600 text-white hover:bg-green-700"
                                        >Connect Google</button>
                                    ) : (
                                        <>
                                            <select value={googleWorkCalendarId} onChange={(e)=> setGoogleWorkCalendarId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                                <option value="">Work cal…</option>
                                                {googleCalendars.map((c)=> (<option key={c.id} value={c.id}>{c.summary}</option>))}
                                            </select>
                                            <select value={googleHomeCalendarId} onChange={(e)=> setGoogleHomeCalendarId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                                <option value="">Home cal…</option>
                                                {googleCalendars.map((c)=> (<option key={c.id} value={c.id}>{c.summary}</option>))}
                                            </select>
                                            <button onClick={importFromGoogle} disabled={googleSyncBusy} className={`text-xs rounded px-2 py-1 ${googleSyncBusy? 'bg-gray-200 text-gray-500':'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}>{googleSyncBusy? 'Syncing…':'Import'}</button>
                                            <button onClick={exportToGoogle} disabled={googleSyncBusy} className={`text-xs rounded px-2 py-1 ${googleSyncBusy? 'bg-gray-200 text-gray-500':'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}>{googleSyncBusy? 'Syncing…':'Export'}</button>
                                        </>
                                    )}
                                </div>
                            )}
                            {!(isHeather || isAccountManager) && (
                                <select value={ownerFilter} onChange={(e)=>setOwnerFilter(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                    <option value="all">All</option>
                                    <option value="Nick">Nick</option>
                                    <option value="MP">MP</option>
                                </select>
                            )}
                            <button onClick={()=> setTheme(theme==='light'?'dark':'light')} className="p-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                                {theme==='light'? <Moon size={14} /> : <Sun size={14} />}
                            </button>
                            {usingBlob ? (
                                <span className="text-xs text-green-700 bg-green-100 border border-green-200 rounded px-2 py-1">Blob</span>
                            ) : (
                                <span className="text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded px-2 py-1" title="Falling back to local storage">Offline</span>
                            )}
                            {!isHeather && (
                            <button
                                disabled={isBackingUp}
                                onClick={async ()=>{
                                    try {
                                        setIsBackingUp(true);
                                        const payload = { events, tasks, groceries, requests, meals, workFiles, exportedAt: new Date().toISOString() };
                                        const resp = await fetch('/api/save-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payload })});
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
                            >{isBackingUp ? 'Backing…' : 'Backup'}</button>
                            )}
                            {!isHeather && (
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
                                        if (Array.isArray(d.meals)) setMeals(d.meals);
                                        if (Array.isArray(d.workFiles)) setWorkFiles(d.workFiles);
                                        setInfoMessage('Backup restored');
                                    } catch (e) {
                                        setRemoteError(e?.message || 'Restore failed');
                                    } finally {
                                        setIsRestoring(false);
                                    }
                                }}
                                className={`text-xs rounded px-2 py-1 ${isRestoring ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}
                            >{isRestoring ? 'Restoring…' : 'Restore'}</button>
                            )}
                        </div>
                    </div>
                </div>
                ) : (
                <div className="bg-white dark:bg-gray-900 p-2 rounded-2xl shadow border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2 items-center">
                        <button onClick={() => setActiveTab('calendar')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='calendar' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><CalendarDays size={16} /> Calendar</button>
                        <button onClick={() => setActiveTab('groceries')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='groceries' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><ShoppingCart size={16} /> Groceries</button>
                        <button onClick={() => setActiveTab('chores')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='chores' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Chores</button>
                        <button onClick={() => setActiveTab('requests')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='requests' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Star size={16} /> Requests</button>
                        <button onClick={() => setActiveTab('trip')} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeTab==='trip' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}><Clipboard size={16} /> Trip planner</button>
                        <div className="ml-auto flex items-center gap-2">
                            {/* Google Calendar controls */}
                            <div className="flex items-center gap-2">
                                {!googleAuthorized ? (
                                    <button
                                        onClick={async ()=>{ try { await ensureGoogleToken(); await listGoogleCalendars(); } catch(_){} }}
                                        className="text-xs rounded px-2 py-1 bg-green-600 text-white hover:bg-green-700"
                                    >Connect Google</button>
                                ) : (
                                    <>
                                        <select value={googleWorkCalendarId} onChange={(e)=> setGoogleWorkCalendarId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                            <option value="">Work cal…</option>
                                            {googleCalendars.map((c)=> (<option key={c.id} value={c.id}>{c.summary}</option>))}
                                        </select>
                                        <select value={googleHomeCalendarId} onChange={(e)=> setGoogleHomeCalendarId(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                            <option value="">Home cal…</option>
                                            {googleCalendars.map((c)=> (<option key={c.id} value={c.id}>{c.summary}</option>))}
                                        </select>
                                        <button onClick={importFromGoogle} disabled={googleSyncBusy} className={`text-xs rounded px-2 py-1 ${googleSyncBusy? 'bg-gray-200 text-gray-500':'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}>{googleSyncBusy? 'Syncing…':'Import'}</button>
                                        <button onClick={exportToGoogle} disabled={googleSyncBusy} className={`text-xs rounded px-2 py-1 ${googleSyncBusy? 'bg-gray-200 text-gray-500':'bg-gray-100 text-gray-700 hover:bg-gray-200'} border border-gray-200`}>{googleSyncBusy? 'Syncing…':'Export'}</button>
                                    </>
                                )}
                            </div>
                            <select value={ownerFilter} onChange={(e)=>setOwnerFilter(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                <option value="all">All</option>
                                <option value="Nick">Nick</option>
                                <option value="MP">MP</option>
                            </select>
                            <button onClick={()=> setTheme(theme==='light'?'dark':'light')} className="p-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">
                                {theme==='light'? <Moon size={14} /> : <Sun size={14} />}
                            </button>
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
                                        const payload = { events, tasks, groceries, requests, meals, workFiles, exportedAt: new Date().toISOString() };
                                        const resp = await fetch('/api/save-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: payload })});
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
                            >{isBackingUp ? 'Backing…' : 'Backup'}</button>
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
                                        if (Array.isArray(d.meals)) setMeals(d.meals);
                                        if (Array.isArray(d.workFiles)) setWorkFiles(d.workFiles);
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
                )}

                {/* --- Calendar Display --- */}
                {activeTab === 'calendar' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{monthNames[month]} {year}</h3>
                        <div className="flex items-center gap-2">
                                <button onClick={()=> setSelectedDayStr(formatDate(new Date()))} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Open Today</button>
                                <select value={calendarTypeFilter} onChange={(e)=> setCalendarTypeFilter(e.target.value)} className="px-2 py-1 text-xs border border-gray-300 rounded">
                                    <option value="work">Work</option>
                                    <option value="home">Home</option>
                                    <option value="all">All</option>
                                </select>
                            <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                <ChevronLeft className="text-gray-600" size={20} />
                            </button>
                            <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                                <ChevronRight className="text-gray-600" size={20} />
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1">
                            <div className="grid grid-cols-7 text-center font-semibold text-sm text-gray-500 dark:text-gray-300">
                                {dayNames.map(day => <div key={day} className="py-2 border-b-2 border-gray-200 dark:border-gray-700">{day}</div>)}
                            </div>
                            <div className="grid grid-cols-7 grid-rows-6">
                                {renderCalendar()}
                            </div>
                            {remoteError && (
                                <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
                                    <AlertTriangle size={14} />
                                    <span className="flex-1">{remoteError}</span>
                                    <button className="ml-2 text-red-700 hover:text-red-900" onClick={()=> setRemoteError('')}>Dismiss</button>
                                </div>
                            )}
                    </div>
                    </div>
                    {/* Daily Tasks Sidebar */}
                    <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 h-fit lg:sticky lg:top-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">Tasks</h4>
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
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence && appliesOwnerFilter(t.owner)).length===0 && (
                                <div className="text-xs text-gray-500">No {sidebarRecurrence} tasks.</div>
                            )}
                            {tasks.filter(t=>t.recurrence===sidebarRecurrence && appliesOwnerFilter(t.owner)).map((t)=>{
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

                {/* Day Modal */}
            {selectedDayStr && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30" onClick={()=>setSelectedDayStr(null)} />
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-2xl mx-4 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-lg font-bold text-gray-800 dark:text-gray-100">{new Date(selectedDayStr+"T00:00:00").toLocaleDateString(undefined,{weekday:'long', month:'long', day:'numeric'})}</div>
                            <button className="p-1 rounded hover:bg-gray-100" onClick={()=>setSelectedDayStr(null)}><X size={18} /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                                    <select value={newItemType} onChange={(e)=>setNewItemType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                        <option value="task">Task</option>
                                        <option value="event">Event</option>
                                    </select>
                                    {newItemType==='task' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <select value={newTaskRecurrence} onChange={(e)=>setNewTaskRecurrence(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                                <option value="none">One-time</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="biweekly">Biweekly</option>
                                                <option value="monthly">Monthly</option>
                                            </select>
                                            <select value={newTaskType} onChange={(e)=>setNewTaskType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                                <option value="personal">Personal</option>
                                                <option value="work">Work</option>
                                            </select>
                                        </div>
                                    )}
                                    {newItemType==='event' && (
                                        <div className="grid grid-cols-1">
                                            <select value={newEventType} onChange={(e)=>setNewEventType(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                                <option value="work">Work</option>
                                                <option value="personal">Personal</option>
                                            </select>
                                        </div>
                                    )}
                                    {!isHeather && (
                                    <>
                                    <input value={newItemTitle} onChange={(e)=>setNewItemTitle(e.target.value)} placeholder={newItemType==='task'?"Add task":"Add event"} className="md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg" />
                                    <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                        const t = (newItemTitle||'').trim(); if (!t) return;
                                        if (newItemType==='task') { addTaskForDay(selectedDayStr, t, newTaskRecurrence, newTaskType==='work' ? 'work' : 'personal'); }
                                        else { addEventForDay(selectedDayStr, t, newEventType); }
                                        setNewItemTitle('');
                                        setNewTaskRecurrence('none');
                                        setNewTaskType('personal');
                                        setNewEventType('work');
                                    }}>Add</button>
                                    </>
                                    )}
                                </div>
                                </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-700">Tasks</div>
                                    {(() => {
                                        const dayDate = parseYmd(selectedDayStr);
                                        const prevDate = new Date(dayDate);
                                        prevDate.setDate(prevDate.getDate() - 1);
                                        const prevStr = formatDate(prevDate);
                                        const showOverdue = prevStr < formatDate(new Date());
                                        const occ = tasks.filter(t=> occursOnDay(t, dayDate) && appliesOwnerFilter(t.owner));
                                        const overdue = showOverdue ? tasks.filter(t => occursOnDay(t, prevDate) && !isTaskDoneOnDate(t, prevStr) && appliesOwnerFilter(t.owner)) : [];
                                        const todayList = occ.filter(t => !overdue.includes(t));
                                        return (
                                            <>
                                                {overdue.length>0 && <div className="text-xs font-semibold text-red-600">OVERDUE</div>}
                                                {overdue.map((t)=>{
                                                    const checked = isTaskDoneOnDate(t, selectedDayStr);
                                                    const isEditing = editingTaskId === t.id;
                                                    return (
                                                        <div key={`ov-${t.id}`} className="rounded p-2 text-xs" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B' }}>
                                                            {!isEditing ? (
                                                                <div className="flex items-start gap-2">
                                                                    <input type="checkbox" className="mt-0.5" checked={checked} onChange={()=>toggleTaskDone(t.id, selectedDayStr)} />
                                                                    <div className="min-w-0">
                                                                        <div className={checked ? 'line-through text-red-400 truncate' : 'text-red-700 truncate'} title={t.title}>{t.title}</div>
                                                                        {t.notes && <div className="text-[11px] text-red-700 truncate" title={t.notes}>{t.notes}</div>}
                                                                        <div className="flex items-center gap-2 text-[10px]">
                                                                            {t.recurrence && t.recurrence!=='none' && <span className="text-red-700">({t.recurrence})</span>}
                                                                            <span className="px-1.5 py-0.5 rounded border" style={{ backgroundColor: '#FECACA', borderColor: '#FCA5A5', color: '#7F1D1D' }}>{(t.type||'personal')==='work' ? 'Work' : 'Personal'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="ml-auto flex items-center gap-2">
                                                                        <button className="text-red-700 hover:text-red-900" onClick={()=>{ setEditingTaskId(t.id); setEditTaskTitle(t.title); setEditTaskNotes(t.notes||''); }} title="Edit">✎</button>
                                                                        <button className="text-red-700 hover:text-red-900" onClick={()=>deleteTask(t.id)} title="Delete"><Trash2 size={12}/></button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <input value={editTaskTitle} onChange={(e)=>setEditTaskTitle(e.target.value)} className="w-full px-2 py-1 border border-red-200 rounded text-xs" placeholder="Task title" />
                                                                    <textarea value={editTaskNotes} onChange={(e)=>setEditTaskNotes(e.target.value)} rows={2} className="w-full px-2 py-1 border border-red-200 rounded text-xs" placeholder="Notes (optional)" />
                                                                    <div className="flex items-center gap-2">
                                                                        <label className="text-[11px] text-red-700">Repeat</label>
                                                                        <select value={t.recurrence||'none'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, recurrence: e.target.value } : x))} className="px-2 py-1 border border-red-200 rounded text-xs">
                                                                            <option value="none">One-time</option>
                                                                            <option value="daily">Daily</option>
                                                                            <option value="weekly">Weekly</option>
                                                                            <option value="biweekly">Biweekly</option>
                                                                            <option value="monthly">Monthly</option>
                                                                        </select>
                                                                        <label className="text-[11px] text-red-700 ml-2">Type</label>
                                                                        <select value={t.type||'personal'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, type: e.target.value } : x))} className="px-2 py-1 border border-red-200 rounded text-xs">
                                                                            <option value="personal">Personal</option>
                                                                            <option value="work">Work</option>
                                                                        </select>
                                                                        <div className="ml-auto flex items-center gap-2">
                                                                            <button className="text-xs bg-red-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                                const title = editTaskTitle.trim(); if (!title) return;
                                                                                setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, title, notes: editTaskNotes } : x));
                                                                                setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes('');
                                                                            }}>Save</button>
                                                                            <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes(''); }}>Cancel</button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {todayList.map((t)=>{
                                        const checked = isTaskDoneOnDate(t, selectedDayStr);
                                        const isEditing = editingTaskId === t.id;
                                        return (
                                            <div key={t.id} className="rounded p-2 text-xs" style={{ backgroundColor: (t.type||'personal')==='work' ? '#FEF3C7' : '#EFF6FF', border: '1px solid ' + ((t.type||'personal')==='work' ? '#FCD34D' : '#BFDBFE') }}>
                                                {!isEditing ? (
                                                    <div className="flex items-start gap-2">
                                                        <input type="checkbox" className="mt-0.5" checked={checked} onChange={()=>toggleTaskDone(t.id, selectedDayStr)} />
                                                        <div className="min-w-0">
                                                            <div className={checked ? 'line-through text-gray-500 truncate' : 'text-gray-800 truncate'} title={t.title}>{t.title}</div>
                                                            {t.notes && <div className="text-[11px] text-gray-600 truncate" title={t.notes}>{t.notes}</div>}
                                                            <div className="flex items-center gap-2 text-[10px]">
                                                                {t.recurrence && t.recurrence!=='none' && <span className="text-blue-700">({t.recurrence})</span>}
                                                                <span className="px-1.5 py-0.5 rounded border" style={{ backgroundColor: (t.type||'personal')==='work' ? '#FDE68A' : '#DBEAFE', borderColor: (t.type||'personal')==='work' ? '#FCD34D' : '#BFDBFE', color: '#374151' }}>{(t.type||'personal')==='work' ? 'Work' : 'Personal'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            <button className="text-gray-600 hover:text-gray-900" onClick={()=>{ setEditingTaskId(t.id); setEditTaskTitle(t.title); setEditTaskNotes(t.notes||''); }} title="Edit">✎</button>
                                                            <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)} title="Delete"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input value={editTaskTitle} onChange={(e)=>setEditTaskTitle(e.target.value)} className="w-full px-2 py-1 border border-blue-200 rounded text-xs" placeholder="Task title" />
                                                        <textarea value={editTaskNotes} onChange={(e)=>setEditTaskNotes(e.target.value)} rows={2} className="w-full px-2 py-1 border border-blue-200 rounded text-xs" placeholder="Notes (optional)" />
                                                        <div className="flex items-center gap-2">
                                                            <label className="text-[11px] text-gray-700">Repeat</label>
                                                            <select value={t.recurrence||'none'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, recurrence: e.target.value } : x))} className="px-2 py-1 border border-blue-200 rounded text-xs">
                                                                <option value="none">One-time</option>
                                                                <option value="daily">Daily</option>
                                                                <option value="weekly">Weekly</option>
                                                                <option value="biweekly">Biweekly</option>
                                                                <option value="monthly">Monthly</option>
                                                            </select>
                                                            <label className="text-[11px] text-gray-700 ml-2">Type</label>
                                                            <select value={t.type||'personal'} onChange={(e)=> setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, type: e.target.value } : x))} className="px-2 py-1 border border-blue-200 rounded text-xs">
                                                                <option value="personal">Personal</option>
                                                                <option value="work">Work</option>
                                                            </select>
                                                            <div className="ml-auto flex items-center gap-2">
                                                                <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                    const title = editTaskTitle.trim(); if (!title) return;
                                                                    setTasks((prev)=> prev.map((x)=> x.id===t.id ? { ...x, title, notes: editTaskNotes } : x));
                                                                    setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes('');
                                                                }}>Save</button>
                                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingTaskId(null); setEditTaskTitle(''); setEditTaskNotes(''); }}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                                {occ.length===0 && (
                                        <div className="text-xs text-gray-500">No tasks for this day.</div>
                                    )}
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className="space-y-2">
                                    <div className="text-sm font-semibold text-gray-700">Events</div>
                                    {events.filter(e=> e.date===selectedDayStr && appliesOwnerFilter(e.owner)).map((e)=>{
                                        const isEditing = editingEventId === e.id;
                                        return (
                                            <div key={e.id} className="w-full text-[12px] rounded-lg shadow px-2 py-2" style={{ backgroundColor: '#E6E6FA' }}>
                                                {!isEditing ? (
                                                    <div className="flex items-start gap-2">
                                                        <div className="min-w-0">
                                                            <div className="font-medium text-gray-800 truncate" title={e.title}>{e.title}</div>
                                                            {e.notes && <div className="text-[11px] text-gray-700 truncate" title={e.notes}>{e.notes}</div>}
                                                        </div>
                                                        <div className="ml-auto flex items-center gap-2">
                                                            <button className="text-gray-700 hover:text-gray-900" onClick={()=>{ setEditingEventId(e.id); setEditEventTitle(e.title); setEditEventNotes(e.notes||''); }} title="Edit">✎</button>
                                                            <button className="text-gray-700 hover:text-gray-900" onClick={()=>deleteEvent(e.id)} title="Delete"><Trash2 size={14}/></button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input value={editEventTitle} onChange={(ev)=>setEditEventTitle(ev.target.value)} className="w-full px-2 py-1 border border-purple-200 rounded text-xs" placeholder="Event title" />
                                                        <textarea value={editEventNotes} onChange={(ev)=>setEditEventNotes(ev.target.value)} rows={2} className="w-full px-2 py-1 border border-purple-200 rounded text-xs" placeholder="Notes (optional)" />
                                                        <div className="flex items-center gap-2">
                                                            <button className="text-xs bg-blue-600 text-white rounded px-2 py-1" onClick={()=>{
                                                                const title = editEventTitle.trim(); if (!title) return;
                                                                setEvents((prev)=> prev.map((x)=> x.id===e.id ? { ...x, title, notes: editEventNotes } : x));
                                                                setEditingEventId(null); setEditEventTitle(''); setEditEventNotes('');
                                                            }}>Save</button>
                                                            <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{ setEditingEventId(null); setEditEventTitle(''); setEditEventNotes(''); }}>Cancel</button>
                                            </div>
                                    </div>
                                )}
                            </div>
                                        );
                                    })}
                                    {events.filter(e=> e.date===selectedDayStr).length===0 && (
                                        <div className="text-xs text-gray-500">No events for this day.</div>
                                    )}
                                </div>
                                                        </div>
                                                    </div>
                                                    </div>
                                                </div>
                )}

                {/* Filter row under tab bar - only on calendar tab */}
                {activeTab==='calendar' && (
                <div className="bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Calendar Filter:</div>
                    <select value={calendarTypeFilter} onChange={(e)=> setCalendarTypeFilter(e.target.value)} className="px-2 py-1 text-xs border border-gray-300 rounded" disabled={isHeather}>
                        <option value="work">Work</option>
                        <option value="home">Home</option>
                        <option value="all">All</option>
                    </select>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="font-semibold text-gray-700 dark:text-gray-300">Nick</div>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={!!calendarVisibility.Nick.work} onChange={(e)=> setCalendarVisibility((prev)=> ({...prev, Nick: { ...prev.Nick, work: e.target.checked }}))} disabled={isHeather} /> Work</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={!!calendarVisibility.Nick.personal} onChange={(e)=> setCalendarVisibility((prev)=> ({...prev, Nick: { ...prev.Nick, personal: e.target.checked }}))} disabled={isHeather} /> Home</label>
                        <div className="font-semibold text-gray-700 dark:text-gray-300 ml-4">MP</div>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={!!calendarVisibility.MP.work} onChange={(e)=> setCalendarVisibility((prev)=> ({...prev, MP: { ...prev.MP, work: e.target.checked }}))} disabled={isHeather} /> Work</label>
                        <label className="flex items-center gap-1"><input type="checkbox" checked={!!calendarVisibility.MP.personal} onChange={(e)=> setCalendarVisibility((prev)=> ({...prev, MP: { ...prev.MP, personal: e.target.checked }}))} disabled={isHeather} /> Home</label>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                        <button className="px-2 py-1 border rounded text-xs" onClick={()=> setCalendarVisibility({ Nick: { work: true, personal: true }, MP: { work: true, personal: true } })}>All</button>
                        <button className="px-2 py-1 border rounded text-xs" onClick={()=> setCalendarVisibility({ Nick: { work: mode==='work', personal: mode==='home' }, MP: { work: mode==='work', personal: mode==='home' } })}>Mode</button>
                    </div>
                </div>
                )}

                {/* Trip Planner (Home only) */}
                {mode==='home' && activeTab === 'trip' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">Trip planner</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <input value={tripTitle} onChange={(e)=> setTripTitle(e.target.value)} placeholder="Trip name" className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
                        <input type="date" value={tripStart} onChange={(e)=> setTripStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                        <input type="date" value={tripEnd} onChange={(e)=> setTripEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                        <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                            const title = (tripTitle||'').trim(); if (!title) return;
                            const id = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                            setTrips(prev => [...prev, { id, title, startDate: tripStart || null, endDate: tripEnd || null, items: [] }]);
                            setActiveTripId(id);
                            setTripTitle(''); setTripStart(''); setTripEnd('');
                        }}>Create trip</button>
                        <select value={activeTripId || ''} onChange={(e)=> setActiveTripId(e.target.value || null)} className="px-3 py-2 border border-gray-300 rounded-lg">
                            <option value="">Select existing trip...</option>
                            {trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>

                    {activeTripId && (
                    <div className="space-y-4">
                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                                <input value={tripItemTitle} onChange={(e)=> setTripItemTitle(e.target.value)} placeholder="Stop title (e.g. Museum)" className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
                                <input type="time" value={tripItemTime} onChange={(e)=> setTripItemTime(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                                <div className="md:col-span-2">
                                    <input value={placeQuery} onChange={(e)=>{
                                        const q = e.target.value; setPlaceQuery(q);
                                        if (placesTimerRef.current) clearTimeout(placesTimerRef.current);
                                        if (!q) { setPlaceResults([]); return; }
                                        placesTimerRef.current = setTimeout(async ()=>{
                                            try {
                                                const resp = await fetch('/api/google-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'autocomplete', input: q })});
                                                const json = await resp.json();
                                                if (!resp.ok) throw new Error(json?.error || 'Autocomplete failed');
                                                setPlaceResults(Array.isArray(json?.predictions) ? json.predictions : []);
                                            } catch(err) { setPlaceResults([]); setRemoteError(err?.message || 'Autocomplete failed'); }
                                        }, 250);
                                    }} placeholder="Search a place" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                                    {placeResults.length>0 && (
                                        <div className="mt-1 max-h-48 overflow-auto border border-gray-200 rounded-lg bg-white text-sm">
                                            {placeResults.map((p)=> (
                                                <div key={p.place_id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer" onClick={async ()=>{
                                                    setPlaceResults([]); setPlaceQuery(p.description);
                                                    try {
                                                        const resp = await fetch('/api/google-places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'details', placeId: p.place_id })});
                                                        const json = await resp.json();
                                                        if (!resp.ok) throw new Error(json?.error || 'Place details failed');
                                                        setSelectedPlace(json?.place || null);
                                                    } catch(err) { setSelectedPlace(null); setRemoteError(err?.message || 'Place details failed'); }
                                                }}>{p.description}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                    const title = (tripItemTitle||'').trim(); if (!title || !selectedPlace) return;
                                    const tid = activeTripId;
                                    const iid = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
                                    setTrips(prev => prev.map(t => t.id===tid ? { ...t, items: [...(t.items||[]), { id: iid, title, time: tripItemTime || null, place: selectedPlace }] } : t));
                                    setTripItemTitle(''); setTripItemTime(''); setPlaceQuery(''); setSelectedPlace(null);
                                }}>Add stop</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                {(trips.find(t=> t.id===activeTripId)?.items || []).map((it, idx)=> (
                                    <div key={it.id} className="flex items-start gap-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                        <div className="text-xs font-semibold text-gray-600 w-24">{it.time || '--:--'}</div>
                                        <div className="min-w-0">
                                            <div className="text-sm text-gray-800 dark:text-gray-100 truncate">{it.title}</div>
                                            {it.place && <div className="text-[11px] text-gray-600 truncate">{it.place.name} · {it.place.address}</div>}
                                        </div>
                                        <div className="ml-auto flex items-center gap-2">
                                            <div className="flex items-center gap-1">
                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 disabled:opacity-50" disabled={idx===0} onClick={()=> moveTripItem(activeTripId, it.id, 'up')}>↑</button>
                                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1 disabled:opacity-50" disabled={idx===(trips.find(t=> t.id===activeTripId)?.items||[]).length-1} onClick={()=> moveTripItem(activeTripId, it.id, 'down')}>↓</button>
                                            </div>
                                            <a className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" target="_blank" rel="noreferrer" href={it.place?.url || (it.place?.location ? `https://www.google.com/maps/search/?api=1&query=${it.place.location.lat},${it.place.location.lng}` : '#')}>Open in Maps</a>
                                            <button className="text-xs bg-red-100 text-red-700 rounded px-2 py-1" onClick={()=> setTrips(prev => prev.map(t=> t.id===activeTripId ? { ...t, items: (t.items||[]).filter(x=> x.id!==it.id) } : t))}>Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {(trips.find(t=> t.id===activeTripId)?.items || []).length===0 && (
                                    <div className="text-xs text-gray-500">No stops yet. Add a place above.</div>
                                )}
                            </div>
                            <div className="h-72 lg:h-96">
                                <div className="mb-2 flex items-center gap-2 text-xs">
                                    <span className="text-gray-600">Mode</span>
                                    <select value={travelMode} onChange={(e)=> setTravelMode(e.target.value)} className="px-2 py-1 border border-gray-300 rounded">
                                        <option value="driving">Driving</option>
                                        <option value="walking">Walking</option>
                                        <option value="bicycling">Bicycling</option>
                                        <option value="transit">Transit</option>
                                    </select>
                                </div>
                                {(() => {
                                    const items = (trips.find(t=> t.id===activeTripId)?.items || []);
                                    if (items.length < 2) return <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-gray-200 rounded-lg">Add 2+ stops to view directions</div>;
                                    const origin = items[0]?.place?.location;
                                    const destination = items[items.length-1]?.place?.location;
                                    const waypoints = items.slice(1, items.length-1).map(it => `${it.place.location.lat},${it.place.location.lng}`).join('|');
                                    if (!origin || !destination) return <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-gray-200 rounded-lg">Missing coordinates</div>;
                                    const params = {
                                        origin: `${origin.lat},${origin.lng}`,
                                        destination: `${destination.lat},${destination.lng}`,
                                        mode: 'driving',
                                    };
                                    if (waypoints) params.waypoints = waypoints;
                                    const q = new URLSearchParams(params).toString();
                                    const key = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';
                                    if (!key) return <div className="h-full flex items-center justify-center text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">Missing REACT_APP_GOOGLE_MAPS_API_KEY</div>;
                                    const url = `https://www.google.com/maps/embed/v1/directions?key=${encodeURIComponent(key)}&${q}`;
                                    return <iframe title="Directions" className="w-full h-full rounded-lg border" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" src={url} />;
                                })()}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
                )}

                {/* Groceries Tab (Home only) */}
                {mode==='home' && activeTab === 'groceries' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className={`text-sm font-semibold px-3 py-1 rounded cursor-pointer ${groceriesSubtab==='list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={()=>setGroceriesSubtab('list')}>List</div>
                        <div className={`text-sm font-semibold px-3 py-1 rounded cursor-pointer ${groceriesSubtab==='planner' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={()=>setGroceriesSubtab('planner')}>Meal Planner</div>
                    </div>

                    {groceriesSubtab==='list' && (
                        <>
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
                        </>
                    )}

                    {groceriesSubtab==='planner' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                                <div className="text-sm font-semibold text-gray-700">Create Meal</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    <input value={mealTitle} onChange={(e)=>setMealTitle(e.target.value)} placeholder="Meal title" className="px-3 py-2 border border-gray-300 rounded-lg" />
                                    <input value={mealLink} onChange={(e)=>setMealLink(e.target.value)} placeholder="Recipe link (optional)" className="px-3 py-2 border border-gray-300 rounded-lg" />
                                    <div className="md:col-span-1" />
                                </div>
                                <textarea value={mealRecipe} onChange={(e)=>setMealRecipe(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Recipe notes (optional)" />
                                <div className="flex items-center gap-2 text-xs">
                                    <input type="file" accept="image/*,.pdf,.txt,.md" onChange={async (e)=>{
                                        const file = e.target.files && e.target.files[0];
                                        if (!file) return;
                                        try {
                                            const reader = new FileReader();
                                            reader.onload = async () => {
                                                const dataUrl = reader.result;
                                                const resp = await fetch('/api/upload', {
                                                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ dataUrl, filename: file.name, scope: 'recipe' })
                                                });
                                                const json = await resp.json();
                                                if (!resp.ok) throw new Error(json?.error || 'Upload failed');
                                                setMealFileUrl(json.url);
                                            };
                                            reader.readAsDataURL(file);
                                        } catch (err) {
                                            setRemoteError(err?.message || 'Upload failed');
                                        }
                                    }} className="text-xs" />
                                    {mealFileUrl && <a href={mealFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-1 border rounded"><Upload size={12}/>View file</a>}
                                </div>
                                        <div className="space-y-2">
                                    <div className="text-xs font-semibold text-gray-600">Ingredients</div>
                                    {(mealIngredients||[]).map((ing)=> (
                                        <div key={ing.id} className="flex items-center gap-2 text-xs">
                                            <span>{ing.name} {ing.quantity ? `· ${ing.quantity}` : ''}</span>
                                            <button className="ml-auto text-gray-600 hover:text-gray-900" onClick={()=> setMealIngredients((prev)=> prev.filter(i=>i.id!==ing.id))}><Trash2 size={12}/></button>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2">
                                        <input value={ingName} onChange={(e)=>setIngName(e.target.value)} placeholder="Ingredient" className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs" />
                                        <input value={ingQty} onChange={(e)=>setIngQty(e.target.value)} placeholder="Qty" className="w-28 px-2 py-1 border border-gray-300 rounded text-xs" />
                                        <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{
                                            const n = ingName.trim();
                                            if (!n) return; setMealIngredients((prev)=> [...prev, { id: generateId(), name: n, quantity: ingQty.trim() }]); setIngName(''); setIngQty('');
                                        }}>Add</button>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button className="text-xs bg-blue-600 text-white rounded px-3 py-1" onClick={()=>{
                                        const t = mealTitle.trim(); if (!t) return;
                                        const id = generateId();
                                        setMeals((prev)=> [...prev, { id, title: t, recipe: mealRecipe.trim(), link: mealLink.trim(), ingredients: mealIngredients, fileUrl: mealFileUrl, owner: currentUser || 'Nick' }]);
                                        setMealTitle(''); setMealRecipe(''); setMealLink(''); setMealIngredients([]); setMealFileUrl('');
                                    }}>Save Meal</button>
                                </div>
                                                    </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-gray-700">Plan Week</div>
                                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600">Week starting</label>
                                        <input type="date" value={plannerWeekStart} onChange={(e)=>setPlannerWeekStart(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                                    </div>
                                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                                    {[0,1,2,3,4,5,6].map((offset)=>{
                                        const start = parseYmd(plannerWeekStart);
                                        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+offset);
                                        const ymd = formatDate(d);
                                        const label = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
                                        return (
                                            <div key={offset} className="border border-gray-200 rounded p-2 space-y-2">
                                                <div className="text-xs font-semibold text-gray-700">{label}</div>
                                                <select className="w-full px-2 py-1 border border-gray-300 rounded text-xs" value={plannerSelection[ymd]||''} onChange={(e)=> setPlannerSelection((prev)=> ({...prev, [ymd]: e.target.value}))}>
                                                    <option value="">Select meal…</option>
                                                    {meals.map((m)=> <option key={m.id} value={m.id}>{m.title}</option>)}
                                                </select>
                                        </div>
                                    );
                                    })}
                            </div>
                                <div className="flex justify-end">
                                    <button className="text-sm bg-green-600 text-white rounded px-3 py-2 hover:bg-green-700" onClick={()=>{
                                        // Add selected meals to calendar as events and push ingredients to groceries
                                        const addedGroceries = [];
                                        Object.entries(plannerSelection).forEach(([ymd, mealId])=>{
                                            if (!mealId) return;
                                            const meal = meals.find(m=>m.id===mealId); if (!meal) return;
                                            // create event
                                            setEvents((prev)=> [...prev, { id: generateId(), title: meal.title, date: ymd, notes: meal.link ? `Recipe: ${meal.link}\n` + (meal.recipe||'') : (meal.recipe||'') , type: 'personal', owner: currentUser || 'Nick' }]);
                                            // add ingredients
                                            (meal.ingredients||[]).forEach((ing)=>{
                                                addedGroceries.push({ id: generateId(), name: ing.name, quantity: ing.quantity||'', checked: false });
                                            });
                                        });
                                        if (addedGroceries.length>0) setGroceries((prev)=> [...prev, ...addedGroceries]);
                                        // Clear selection
                                        setPlannerSelection({});
                                    }}>Make Plan</button>
                        </div>
                    </div>
                </div>
            )}
                </div>
                )}

                {/* Home: Chores tab */}
                {mode==='home' && activeTab==='chores' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="text-xl font-bold text-gray-800 dark:text-gray-100">Chores</div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                            <select value={newTaskRecurrence} onChange={(e)=>setNewTaskRecurrence(e.target.value)} className="px-2 py-2 border border-gray-300 rounded-lg text-sm">
                                <option value="none">One-time</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="biweekly">Biweekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                            <input value={newItemTitle} onChange={(e)=>setNewItemTitle(e.target.value)} placeholder="Add chore" className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
                            <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                const t = (newItemTitle||'').trim(); if (!t) return;
                                const todayStr = formatDate(new Date());
                                addTaskForDay(todayStr, t, newTaskRecurrence, 'personal');
                                setNewItemTitle(''); setNewTaskRecurrence('none');
                            }}>Add</button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {tasks.filter(t=> (t.type||'personal')==='personal' && appliesOwnerFilter(t.owner)).map((t)=>{
                            const todayStr = formatDate(new Date());
                            const checked = isTaskDoneOnDate(t, todayStr);
                            return (
                                <label key={`home-${t.id}`} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-2 py-2 text-xs">
                                    <input type="checkbox" checked={checked} onChange={()=>toggleTaskDone(t.id, todayStr)} />
                                    <span className={checked ? 'line-through text-gray-500' : 'text-gray-800'}>{t.title}</span>
                                    <button className="ml-auto text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={12} /></button>
                                </label>
                            );
                        })}
                        {tasks.filter(t=> (t.type||'personal')==='personal' && appliesOwnerFilter(t.owner)).length===0 && (
                            <div className="text-xs text-gray-500">No chores yet.</div>
                        )}
                    </div>
                </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
                    {mode==='work' ? (
                    <>
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-100">{isAccountManager ? 'Requests for Nick to Do' : 'Boss Requests'}</div>
                        <div className="text-xs text-gray-500">{isAccountManager ? 'Submit a request for Nick. Heather will review and approve/deny.' : 'Add, approve, or complete requests from your boss. Approved requests appear on the calendar on their approved date.'}</div>
                        <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
                            {isAccountManager ? (
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                    <input value={amName} onChange={(e)=>setAmName(e.target.value)} placeholder="Your name" className="px-2 py-1 border border-amber-300 rounded text-sm" />
                                    <input value={amTitle} onChange={(e)=>setAmTitle(e.target.value)} placeholder="Task title" className="px-2 py-1 border border-amber-300 rounded text-sm" />
                                    <select value={amPriority} onChange={(e)=>setAmPriority(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-sm">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                    <input type="date" value={amDueDate} onChange={(e)=>setAmDueDate(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-sm" />
                                    <input value={amDetails} onChange={(e)=>setAmDetails(e.target.value)} placeholder="Details/notes (optional)" className="px-2 py-1 border border-amber-300 rounded text-sm md:col-span-2" />
                                    <button className="bg-amber-600 text-white text-xs rounded px-2 py-1" onClick={handleAddAccountManagerRequest}>Submit</button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                                    <input value={bossReqTitle} onChange={(e)=>setBossReqTitle(e.target.value)} placeholder="Title" className="px-2 py-1 border border-amber-300 rounded text-sm" />
                                    <select value={bossReqPriority} onChange={(e)=>setBossReqPriority(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-sm">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                    <input type="date" value={bossReqDueDate} onChange={(e)=>setBossReqDueDate(e.target.value)} className="px-2 py-1 border border-amber-300 rounded text-sm" />
                                    <input value={bossReqDetails} onChange={(e)=>setBossReqDetails(e.target.value)} placeholder="Details (optional)" className="px-2 py-1 border border-amber-300 rounded text-sm md:col-span-2" />
                                    <button className="bg-amber-600 text-white text-xs rounded px-2 py-1" onClick={()=>{
                                        if (!bossReqTitle.trim()) return;
                                        const prevUser = currentUser;
                                        if (isHeather) setCurrentUser('Nick');
                                        handleAddRequest(bossReqDueDate || formatDate(new Date()), bossReqTitle, bossReqPriority, bossReqDetails, 'boss');
                                        if (isHeather) setCurrentUser(prevUser);
                                        setBossReqTitle(''); setBossReqPriority('medium'); setBossReqDueDate(''); setBossReqDetails('');
                                    }}>Add</button>
                                </div>
                            )}
                            <div className="space-y-2">
                                {(isHeather
                                    ? requests.filter(r=> (r.source==='boss' || r.source==='account_manager') && (r.owner==='Nick' || !r.owner) && r.status==='pending')
                                    : isAccountManager
                                        ? requests.filter(r=> r.source==='account_manager' && (r.owner==='Nick' || !r.owner))
                                        : requests.filter(r=> r.source==='boss' && appliesOwnerFilter(r.owner))
                                ).map((r)=>(
                                    <div key={`boss-${r.id}`} className="flex items-center justify-between rounded px-3 py-2 text-xs bg-white border border-amber-200">
                                        <div>
                                            <div className="font-semibold text-gray-800">{r.title}</div>
                                            <div className="text-[11px] text-gray-600 capitalize">{r.priority}{r.submittedBy ? ` · from ${r.submittedBy}` : ''}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isHeather && r.status==='pending' && (
                                                <>
                                                    <input type="date" defaultValue={r.requestedDueDate ? formatDate(r.requestedDueDate) : ''} onChange={(e)=>updateRequest(r.id, { requestedDueDate: new Date(e.target.value).toISOString() })} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                                    <select defaultValue={r.priority} onChange={(e)=>updateRequest(r.id, { priority: e.target.value })} className="px-2 py-1 border border-gray-300 rounded text-xs">
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                    <button className="text-xs bg-green-600 text-white rounded px-2 py-1" onClick={()=>approveRequest(r.id, r.requestedDueDate ? formatDate(r.requestedDueDate) : formatDate(new Date()))}>Approve</button>
                                                    <button className="text-xs bg-red-600 text-white rounded px-2 py-1" onClick={()=>denyRequest(r.id)}>Deny</button>
                                                </>
                                            )}
                                            <button className="text-xs bg-gray-100 border border-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>openRequestEditor(r)}>Edit</button>
                                            {!isAccountManager && <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteRequest(r.id)}><Trash2 size={12}/></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {isHeather && (
                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-gray-700 mt-4">Nick's Requests Approved</div>
                                {requests.filter(r=> (r.owner==='Nick' || !r.owner) && r.status==='approved').map((r)=>(
                                    <div key={`approved-${r.id}`} className="flex items-center justify-between rounded px-3 py-2 text-xs bg-white border border-green-200">
                                        <div>
                                            <div className="font-semibold text-gray-800">{r.title}</div>
                                            <div className="text-[11px] text-gray-600">Due {r.approvedDueDate ? new Date(r.approvedDueDate).toLocaleDateString() : (r.requestedDueDate ? new Date(r.requestedDueDate).toLocaleDateString() : '')}</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button className="text-xs bg-gray-100 border border-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>openRequestEditor(r)}>Edit</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                    ) : (
                    <>
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-100">Fiancé Requests</div>
                        <div className="text-xs text-gray-500">Add, approve, or complete requests. Approved requests appear on the calendar (light pink) on their approved date.</div>
                        {!isHeather && (
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
                                        source: 'fiance',
                                    };
                                    setRequests((prev)=>[...prev, { ...payload, owner: currentUser || 'Nick' }]);
                                    setReqFormTitle(''); setReqFormDetails(''); setReqFormDueDate(''); setReqFormPriority('medium');
                                }}>Add</button>
                            </div>
                        </div>
                        )}
                        <div className="grid grid-cols-1 gap-2">
                            {requests.filter(r=> r.source!=='boss' && (isHeather ? r.owner==='Nick' : appliesOwnerFilter(r.owner))).sort((a,b)=>{
                                const pri = { high: 0, medium: 1, low: 2 };
                                return pri[a.priority]-pri[b.priority];
                            }).map((r)=>(
                                <div key={r.id} className="flex items-center justify-between rounded px-3 py-2 text-sm" style={{ backgroundColor: '#ffd6e7', border: '1px solid #f5a6bd' }}>
                                    <div>
                                        <div className="font-semibold text-[#7a2946]">{r.title}</div>
                                        <div className="text-xs text-[#7a2946]">Priority: <span className="capitalize">{r.priority}</span>{r.requestedDueDate ? ` · requested ${new Date(r.requestedDueDate).toLocaleDateString()}` : ''}{r.approvedDueDate ? ` · approved ${new Date(r.approvedDueDate).toLocaleDateString()}` : ''}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isHeather && r.status==='pending' && (
                                            <>
                                                <input type="date" defaultValue={r.requestedDueDate ? formatDate(r.requestedDueDate) : ''} onChange={(e)=>approveRequest(r.id, e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-xs" />
                                                <button className="text-xs bg-green-600 text-white rounded px-2 py-1 hover:bg-green-700" onClick={()=>approveRequest(r.id, r.requestedDueDate ? formatDate(r.requestedDueDate) : formatDate(new Date()))}>Approve</button>
                                            </>
                                        )}
                                        {!isHeather && r.status!=='completed' && <button className="text-xs bg-blue-600 text-white rounded px-2 py-1 hover:bg-blue-700" onClick={()=>completeRequest(r.id)}>Done</button>}
                                        <button className="text-xs bg-gray-100 border border-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>openRequestEditor(r)}>Edit</button>
                                        {!isHeather && <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteRequest(r.id)}><Trash2 size={14}/></button>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </> )}
                </div>
                )}

                {/* Request Edit Modal */}
                {requestEditId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40" onClick={closeRequestEditor}></div>
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4">
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Edit Request</div>
                        <div className="space-y-2 text-sm">
                            <label className="block">
                                <div className="text-gray-700 dark:text-gray-300 mb-1">Title</div>
                                <input value={requestEdit.title} onChange={(e)=>setRequestEdit((p)=>({...p, title: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded" />
                            </label>
                            <label className="block">
                                <div className="text-gray-700 dark:text-gray-300 mb-1">Details / Notes</div>
                                <textarea value={requestEdit.details} onChange={(e)=>setRequestEdit((p)=>({...p, details: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded min-h-[80px]"></textarea>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <div className="text-gray-700 dark:text-gray-300 mb-1">Priority</div>
                                    <select value={requestEdit.priority} onChange={(e)=>setRequestEdit((p)=>({...p, priority: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded">
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </label>
                                <label className="block">
                                    <div className="text-gray-700 dark:text-gray-300 mb-1">Due date</div>
                                    <input type="date" value={requestEdit.dueDate} onChange={(e)=>setRequestEdit((p)=>({...p, dueDate: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded" />
                                </label>
                            </div>
                            <label className="block">
                                <div className="text-gray-700 dark:text-gray-300 mb-1">Submitted by</div>
                                <input value={requestEdit.submittedBy} onChange={(e)=>setRequestEdit((p)=>({...p, submittedBy: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded" placeholder="Name (optional)" />
                            </label>
                        </div>
                        <div className="mt-4 flex items-center gap-2 justify-end">
                            <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700" onClick={closeRequestEditor}>Cancel</button>
                            <button className="px-3 py-1.5 rounded bg-blue-600 text-white" onClick={saveRequestEditor}>Save</button>
                        </div>
                    </div>
                </div>
                )}

                {/* Work Tab (Work mode only) */}
                {mode==='work' && activeTab === 'work' && !isHeather && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-4">
                    <div className="flex items-center gap-2">
                        <Briefcase size={18} />
                        <div className="text-xl font-bold text-gray-800 dark:text-gray-100">Work — Today</div>
                        <div className="ml-auto text-xs text-gray-500">{formatDate(new Date())}</div>
                    </div>
                    {/* Quick upload for work files */}
                    <div className="flex items-center gap-2 text-xs">
                        <label className="px-2 py-1 bg-gray-100 border rounded cursor-pointer inline-flex items-center gap-1">
                            <Upload size={12} /> Upload file
                            <input type="file" className="hidden" onChange={async (e)=>{
                                const file = e.target.files && e.target.files[0];
                                if (!file) return;
                                try {
                                    const reader = new FileReader();
                                    reader.onload = async () => {
                                        const dataUrl = reader.result;
                                        const resp = await fetch('/api/upload', {
                                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ dataUrl, filename: file.name, scope: 'work' })
                                        });
                                        const json = await resp.json();
                                        if (!resp.ok) throw new Error(json?.error || 'Upload failed');
                                        const fileEntry = { id: generateId(), title: file.name, url: json.url, owner: currentUser || 'Nick', uploadedAt: new Date().toISOString() };
                                        setWorkFiles((prev)=> [...prev, fileEntry]);
                                        setInfoMessage('File uploaded');
                                    };
                                    reader.readAsDataURL(file);
                                } catch (err) {
                                    setRemoteError(err?.message || 'Upload failed');
                                }
                            }} />
                        </label>
                        {workFiles.length>0 && <span className="text-gray-600">{workFiles.length} file(s)</span>}
                    </div>
                    <div className="space-y-2">
                        {tasks.filter(t=> (t.type||'personal')==='work' && occursOnDay(t, new Date()) && appliesOwnerFilter(t.owner) ).length===0 && (
                            <div className="text-xs text-gray-500">No work tasks for today.</div>
                        )}
                        {tasks
                            .filter(t=> (t.type||'personal')==='work' && occursOnDay(t, new Date()) && appliesOwnerFilter(t.owner))
                            .sort((a,b)=> (a.priority||3) - (b.priority||3))
                            .map((t)=>{
                            const todayStr = formatDate(new Date());
                            const checked = isTaskDoneOnDate(t, todayStr);
                            return (
                                <div key={`work-${t.id}`} className="rounded px-3 py-2 text-sm" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FCD34D' }}>
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" checked={checked} onChange={()=>toggleTaskDone(t.id, todayStr)} />
                                        <div className="min-w-0">
                                            <div className={checked ? 'line-through text-gray-500 truncate' : 'text-gray-800 truncate'} title={t.title}>{t.title}</div>
                                            {t.notes && <div className="text-xs text-gray-600 truncate" title={t.notes}>{t.notes}</div>}
                                            {t.recurrence && t.recurrence!=='none' && <div className="text-[11px] text-gray-600">({t.recurrence})</div>}
                                        </div>
                                        <div className="ml-auto flex items-center gap-2">
                                            <button className="text-gray-700 hover:text-gray-900" title="Open notes" onClick={()=>{ setWorkNotesTaskId(t.id); setWorkNotesDraft(t.notes||''); }}>
                                                <Clipboard size={16} />
                                            </button>
                                            <div className="flex items-center gap-1 text-xs">
                                                <span className="text-gray-600">P</span>
                                                <select value={t.priority ?? 3} onChange={(e)=> setTasks((prev)=> prev.map(x=> x.id===t.id ? { ...x, priority: parseInt(e.target.value,10) } : x))} className="px-1 py-0.5 border border-amber-300 rounded">
                                                    <option value={1}>1</option>
                                                    <option value={2}>2</option>
                                                    <option value={3}>3</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs">
                                                <span className="text-gray-600">Est</span>
                                                <select value={t.estimate || ''} onChange={(e)=> setTasks((prev)=> prev.map(x=> x.id===t.id ? { ...x, estimate: e.target.value } : x))} className="px-1 py-0.5 border border-amber-300 rounded">
                                                    <option value="">—</option>
                                                    <option value="30m">30m</option>
                                                    <option value="1h">1h</option>
                                                    <option value="90m">90m</option>
                                                    <option value="2h">2h</option>
                                                    <option value="3h">3h</option>
                                                </select>
                                            </div>
                                            <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteTask(t.id)}><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                    {/* Subtasks */}
                                    <div className="mt-2 space-y-2">
                                        {(t.subtasks||[]).map((s)=>{
                                            const subChecked = Array.isArray(s.completedDates) && s.completedDates.includes(todayStr);
                                            return (
                                                <div key={s.id} className="flex items-start gap-2 text-xs bg-white/60 rounded border border-amber-200 px-2 py-1">
                                                    <input type="checkbox" className="mt-0.5" checked={subChecked} onChange={()=>toggleSubtaskDone(t.id, s.id, todayStr)} />
                                                    <div className="min-w-0">
                                                        <div className={subChecked ? 'line-through text-gray-500 truncate' : 'text-gray-800 truncate'} title={s.title}>{s.title}</div>
                                                        {s.notes && <div className="text-[11px] text-gray-600 truncate" title={s.notes}>{s.notes}</div>}
                                                    </div>
                                                    <div className="ml-auto flex items-center gap-2">
                                                        <button className="text-gray-700 hover:text-gray-900" title="Open subtask notes" onClick={()=>{ setWorkSubNotesTaskId(t.id); setWorkSubNotesSubId(s.id); setWorkSubNotesDraft(s.notes||''); }}> <Clipboard size={14} /> </button>
                                                        <button className="text-gray-600 hover:text-gray-900" onClick={()=>deleteSubtask(t.id, s.id)}><Trash2 size={12}/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex items-center gap-2 text-xs">
                                            <input value={newSubTitleByTask[t.id]||''} onChange={(e)=> setNewSubTitleByTask((prev)=> ({...prev, [t.id]: e.target.value}))} placeholder="Add subtask" className="flex-1 px-2 py-1 border border-amber-300 rounded" />
                                            <button className="bg-amber-600 text-white rounded px-2 py-1" onClick={()=>{ addSubtask(t.id, newSubTitleByTask[t.id]||''); setNewSubTitleByTask((prev)=> ({...prev, [t.id]: ''})); }}>Add</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* After Work Planner Tab */}
                {activeTab === 'afterwork' && !isHeather && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">After work planner</div>
                        <div className="ml-auto flex items-center gap-2">
                            <input type="date" value={awpDate || ''} onChange={(e)=> setAwpDate(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                            <input value={awpTitle} onChange={(e)=> setAwpTitle(e.target.value)} placeholder="What are you doing?" className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg" />
                            <input type="time" min="16:00" max="22:00" value={awpStart} onChange={(e)=> setAwpStart(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <input type="time" min="16:00" max="22:00" value={awpEnd} onChange={(e)=> setAwpEnd(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                            <button className="bg-blue-600 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-blue-700" onClick={()=>{
                                const title = (awpTitle||'').trim(); if (!title) return;
                                const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                                setAfterWorkPlans(prev => [...prev, { id, date: awpDate, title, start: awpStart, end: awpEnd }]);
                                setAwpTitle('');
                            }}>Add</button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {(afterWorkPlans.filter(p=> p.date === awpDate).sort((a,b)=> (a.start||'').localeCompare(b.start))).map((p)=> (
                            <div key={p.id} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                <div className="text-xs font-semibold text-gray-600 w-24">{p.start} - {p.end}</div>
                                <div className="text-sm text-gray-800 dark:text-gray-100 truncate">{p.title}</div>
                                <div className="ml-auto flex items-center gap-2">
                                    <button className="text-xs bg-gray-200 text-gray-700 rounded px-2 py-1" onClick={()=>{
                                        const title = prompt('Edit title', p.title);
                                        if (title===null) return;
                                        setAfterWorkPlans(prev => prev.map(x => x.id===p.id ? { ...x, title: title.trim() } : x));
                                    }}>Edit</button>
                                    <button className="text-xs bg-red-100 text-red-700 rounded px-2 py-1" onClick={()=> setAfterWorkPlans(prev => prev.filter(x => x.id!==p.id))}>Delete</button>
                                </div>
                            </div>
                        ))}
                        {afterWorkPlans.filter(p=> p.date === awpDate).length===0 && (
                            <div className="text-xs text-gray-500">No plans yet for this day.</div>
                        )}
                    </div>
                </div>
                )}

                {/* Work Task Notes Modal */}
                {workNotesTaskId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/30" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }} />
                        <div className="relative bg-white w-full max-w-md mx-4 rounded-2xl shadow-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-800">Task Notes</div>
                                <button className="p-1 rounded hover:bg-gray-100" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }}><X size={16} /></button>
                            </div>
                            <textarea value={workNotesDraft} onChange={(e)=>setWorkNotesDraft(e.target.value)} rows={8} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="Add notes..." />
                            <div className="mt-3 flex justify-end gap-2">
                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-3 py-1" onClick={()=>{ setWorkNotesTaskId(null); setWorkNotesDraft(''); }}>Cancel</button>
                                <button className="text-xs bg-blue-600 text-white rounded px-3 py-1" onClick={()=>{
                                    const id = workNotesTaskId;
                                    setTasks((prev)=> prev.map(x=> x.id===id ? { ...x, notes: workNotesDraft } : x));
                                    setWorkNotesTaskId(null); setWorkNotesDraft('');
                                }}>Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Work Subtask Notes Modal */}
                {workSubNotesTaskId && workSubNotesSubId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/30" onClick={()=>{ setWorkSubNotesTaskId(null); setWorkSubNotesSubId(null); setWorkSubNotesDraft(''); }} />
                        <div className="relative bg-white w-full max-w-md mx-4 rounded-2xl shadow-xl border border-gray-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-semibold text-gray-800">Subtask Notes</div>
                                <button className="p-1 rounded hover:bg-gray-100" onClick={()=>{ setWorkSubNotesTaskId(null); setWorkSubNotesSubId(null); setWorkSubNotesDraft(''); }}><X size={16} /></button>
                            </div>
                            <textarea value={workSubNotesDraft} onChange={(e)=>setWorkSubNotesDraft(e.target.value)} rows={8} className="w-full px-3 py-2 border border-gray-300 rounded text-sm" placeholder="Add notes..." />
                            <div className="mt-3 flex justify-end gap-2">
                                <button className="text-xs bg-gray-200 text-gray-700 rounded px-3 py-1" onClick={()=>{ setWorkSubNotesTaskId(null); setWorkSubNotesSubId(null); setWorkSubNotesDraft(''); }}>Cancel</button>
                                <button className="text-xs bg-blue-600 text-white rounded px-3 py-1" onClick={()=>{
                                    const tId = workSubNotesTaskId; const sId = workSubNotesSubId;
                                    setTasks((prev)=> prev.map(t=>{
                                        if (t.id!==tId) return t;
                                        const subtasks = (t.subtasks||[]).map(s=> s.id===sId ? { ...s, notes: workSubNotesDraft } : s);
                                        return { ...t, subtasks };
                                    }));
                                    setWorkSubNotesTaskId(null); setWorkSubNotesSubId(null); setWorkSubNotesDraft('');
                                }}>Save</button>
                            </div>
                        </div>
                    </div>
                )}
                </>
                )}

            </div>
        </div>
    );
}
