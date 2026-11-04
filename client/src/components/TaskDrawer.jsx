import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';

const STATUSES = ['To Do', 'In Progress', 'In Review', 'Completed'];
const PRIORITIES = ['Low', 'Medium', 'High'];

export default function TaskDrawer({ task, workspaceId, onClose, onSaved, onDeleted }) {
  const drawerRef = useRef(null), closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [members, setMembers] = useState([]), [title, setTitle] = useState(task.title), [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState(task.status), [priority, setPriority] = useState(task.priority), [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '');
  const [assignees, setAssignees] = useState((task.assignees || []).map(member => String(member._id || member))), [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/workspaces/${workspaceId}/members`).then(data => setMembers(data.items || [])).catch(error => toast.error(error.message)); }, [workspaceId]);
  useEffect(() => { const drawer=drawerRef.current; if(!drawer)return; const previous=document.activeElement; const focusable=()=>[...drawer.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]; (drawer.querySelector('[autofocus]')||focusable()[0]||drawer).focus(); function onKeyDown(event){if(event.key==='Escape'){event.preventDefault();closeRef.current();return;}if(event.key!=='Tab')return;const nodes=focusable();if(!nodes.length){event.preventDefault();drawer.focus();}else if(event.shiftKey&&document.activeElement===nodes[0]){event.preventDefault();nodes[nodes.length-1].focus();}else if(!event.shiftKey&&document.activeElement===nodes[nodes.length-1]){event.preventDefault();nodes[0].focus();}} drawer.addEventListener('keydown',onKeyDown); return()=>{drawer.removeEventListener('keydown',onKeyDown);previous?.focus?.();}; }, []);
  function toggleAssignee(id) { setAssignees(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try { await api.patch(`/tasks/${task._id}`, { title, description, status, priority, assignees, dueDate: dueDate ? new Date(`${dueDate}T23:59:59.000Z`).toISOString() : null }); toast.success('Task saved'); onSaved(); }
    catch (error) { toast.error(error.message); } finally { setBusy(false); }
  }
  async function remove() { if (!confirm(`Delete â€œ${task.title}â€? This cannot be undone.`)) return; try { await api.delete(`/tasks/${task._id}`); toast.success('Task deleted'); onDeleted(); } catch (error) { toast.error(error.message); } }
  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><aside ref={drawerRef} tabIndex={-1} className="task-drawer" role="dialog" aria-modal="true" aria-label="Edit task"><div className="drawer-head"><div><span className="eyebrow">TASK DETAILS</span><h2>Edit task</h2></div><button className="icon-button" onClick={onClose} aria-label="Close task details"><X size={18}/></button></div><form onSubmit={save} className="drawer-form"><label>Title<input autoFocus required minLength={2} maxLength={200} value={title} onChange={event => setTitle(event.target.value)}/></label><label>Description<textarea rows="5" maxLength={5000} value={description} onChange={event => setDescription(event.target.value)}/></label><div className="drawer-fields"><label>Status<select value={status} onChange={event => setStatus(event.target.value)}>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value)}>{PRIORITIES.map(value => <option key={value}>{value}</option>)}</select></label></div><label className="date-label"><CalendarDays size={14}/> Due date<input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}/></label><fieldset className="assignee-field"><legend>Assignees</legend>{members.map(member => <label key={member.user._id} className="assignee-option"><input type="checkbox" checked={assignees.includes(String(member.user._id))} onChange={() => toggleAssignee(String(member.user._id))}/><span className="user-avatar small-avatar">{member.user.name?.[0]}</span><span>{member.user.name}<small>{member.role}</small></span></label>)}</fieldset><div className="drawer-meta"><span>Created {new Date(task.createdAt).toLocaleDateString()}</span><span>Updated {new Date(task.updatedAt).toLocaleDateString()}</span></div><div className="drawer-actions"><button type="button" className="button danger" onClick={remove}><Trash2 size={15}/> Delete</button><div><button type="button" className="button ghost" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Savingâ€¦' : 'Save changes'}</button></div></div></form></aside></div>;
}



