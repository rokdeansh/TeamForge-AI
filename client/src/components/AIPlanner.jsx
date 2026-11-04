import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useWorkspace } from '../context/WorkspaceContext';

function Badge({ value }) { return <span className={`badge ${value.toLowerCase()}`}>{value}</span>; }
function PageHeader({ eyebrow, title, description }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>; }

export default function AIPlanner({ projectId }) {
  const { selectedId, selected: workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const { data: projectsData } = useQuery({ queryKey: ['projects', selectedId], queryFn: () => api.get('/projects', { params: { workspaceId: selectedId, limit: 100 } }), enabled: !!selectedId });
  const [idea, setIdea] = useState('');
  const [ideaError, setIdeaError] = useState('');
  const [selectedProject, setSelectedProject] = useState(projectId || 'new');
  const [newProjectName, setNewProjectName] = useState('');
  const [plan, setPlan] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!projectId && !['owner', 'admin'].includes(workspace?.role) && projectsData?.items?.length) setSelectedProject(projectsData.items[0]._id); }, [projectId, workspace?.role, projectsData]);
  async function generate(event) {
    event.preventDefault();
    if (idea.trim().length < 10) { setIdeaError('Enter at least 10 characters to create a useful plan.'); return; }
    setIdeaError(''); setBusy(true);
    try { const data = await api.post('/ai/plan', { workspaceId: selectedId, idea }); setPlan(data.plan); setSelected(new Set(data.plan.phases.flatMap(phase => phase.tasks).map((_, index) => String(index)))); }
    catch (error) { toast.error(error.message); }
    finally { setBusy(false); }
  }
  async function save() {
    let targetProjectId = selectedProject === 'new' ? '' : selectedProject;
    const tasks = plan.phases.flatMap(phase => phase.tasks).filter((_, index) => selected.has(String(index)));
    try {
      if (!targetProjectId) {
        const project = await api.post('/projects', { workspaceId: selectedId, name: newProjectName.trim() || idea.trim().slice(0, 100), description: plan.overview });
        targetProjectId = project.project._id;
      }
      await api.post('/tasks/bulk', { workspaceId: selectedId, projectId: targetProjectId, tasks });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['project-tasks', targetProjectId] }), queryClient.invalidateQueries({ queryKey: ['projects', selectedId] })]); toast.success(`${tasks.length} tasks created`); setPlan(null); setIdea('');
    } catch (error) { toast.error(error.message); }
  }
  async function ask(event) { event.preventDefault(); setBusy(true); try { const data = await api.post('/ai/ask', { workspaceId: selectedId, projectId, question }); setAnswer(data.answer); } catch (error) { toast.error(error.message); } finally { setBusy(false); } }
  async function summarize() { setBusy(true); try { const data = await api.post('/ai/summarize', { workspaceId: selectedId, projectId }); setSummary(data.summary); } catch (error) { toast.error(error.message); } finally { setBusy(false); } }
  let index = 0;
  return <div className="ai-page">
    {!projectId && <PageHeader eyebrow="AI ASSISTANT" title="AI project planner" description="Describe an idea and review a draft plan. Nothing is saved until you approve it."/>}
    <section className="ai-card"><div className="ai-card-head"><span className="ai-mark"><Sparkles size={17}/></span><div><strong>Draft a project plan</strong><small>AI suggestion · review before saving</small></div></div><form noValidate onSubmit={generate}><label htmlFor="idea-input">What are you planning?</label><textarea id="idea-input" rows="5" maxLength={6000} value={idea} onChange={event => { setIdea(event.target.value); setIdeaError(event.target.value.trim().length>0&&event.target.value.trim().length<10?'Use at least 10 characters for a useful plan.':''); }} aria-invalid={!!ideaError} aria-describedby={ideaError?'idea-error':undefined} placeholder="Describe the outcome, audience, constraints, and technologies you have in mind…"/>{ideaError&&<p className="field-error" id="idea-error" role="alert">{ideaError}</p>}<div className="example-prompts"><span>Try an example</span>{['Plan a two week launch campaign for our new mobile app.','Organize a customer feedback program for the next quarter.','Create a rollout plan for migrating our team to a new CRM.'].map(prompt=><button key={prompt} type="button" className="prompt-chip" onClick={()=>{setIdea(prompt);setIdeaError('');}}>{prompt}</button>)}</div><label htmlFor="plan-project">Project</label><select id="plan-project" className="select-control" value={selectedProject} onChange={event=>setSelectedProject(event.target.value)}>{['owner', 'admin'].includes(workspace?.role)&&<option value="new">New project</option>}{(projectsData?.items||[]).map(project=><option key={project._id} value={project._id}>{project.name}</option>)}</select>{selectedProject==='new'&&<label htmlFor="new-project-name">New project name<input id="new-project-name" value={newProjectName} maxLength={100} onChange={event=>setNewProjectName(event.target.value)} placeholder="Use your idea as the project name"/></label>}<div className="form-foot"><small className="muted">Your prompt is sent securely to the configured AI provider.</small><button className="button ai-button" disabled={busy||idea.trim().length<10}><Sparkles size={15}/>{busy ? 'Generating…' : 'Generate plan'}</button></div></form></section>
    {plan && <section className="panel plan-preview"><div className="plan-heading"><div><div className="eyebrow">DRAFT · NOT SAVED</div><h2>Plan preview</h2></div><button className="button primary" onClick={save} disabled={busy||selected.size===0}>Create {selected.size} tasks</button></div><p>{plan.overview}</p><h3>Objectives</h3><ul>{plan.objectives.map((objective, itemIndex) => <li key={itemIndex}>{objective}</li>)}</ul>{plan.phases.map(phase => <div key={phase.name} className="plan-phase"><h3>{phase.name}</h3>{phase.tasks.map(task => { const taskIndex = String(index++); return <label className="plan-task" key={taskIndex}><input type="checkbox" checked={selected.has(taskIndex)} onChange={event => setSelected(previous => { const next = new Set(previous); event.target.checked ? next.add(taskIndex) : next.delete(taskIndex); return next; })}/><span className="grow"><b>{task.title}</b><small>{task.description}</small></span><Badge value={task.priority}/></label>; })}</div>)}{plan.risks.length > 0 && <><h3>Risks to consider</h3><ul>{plan.risks.map((risk, itemIndex) => <li key={itemIndex}>{risk}</li>)}</ul></>}</section>}
    {projectId && <section className="panel ai-project-tools"><div className="panel-heading"><div><h2>Ask about this project</h2><p>Answers use project details, tasks, and notes you can access.</p></div></div><form className="ai-question" noValidate onSubmit={ask}><label className="sr-only" htmlFor="ai-project-question">Ask a question about this project</label><input id="ai-project-question" maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} placeholder="What is blocked? What are the next steps?"/><button className="button ai-button" disabled={busy||question.trim().length<3}>Ask AI</button></form>{answer&&<div className="ai-answer"><span className="eyebrow">FROM PROJECT DATA</span><p>{answer.projectData}</p><span className="eyebrow">AI SUGGESTION</span><p>{answer.recommendation}</p>{answer.sources.length>0&&<small className="muted">Sources: {answer.sources.join(', ')}</small>}</div>}<div className="summary-row"><div><strong>Discussion summary</strong><small>Summarize workspace messages accessible to you.</small></div><button className="button secondary" onClick={summarize} disabled={busy}>Summarize</button></div>{summary&&<div className="ai-answer"><span className="eyebrow">KEY POINTS</span><ul>{summary.keyPoints.map((point,itemIndex)=><li key={itemIndex}>{point}</li>)}</ul><span className="eyebrow">DECISIONS SUPPORTED BY MESSAGES</span>{summary.decisions.length?summary.decisions.map((item,itemIndex)=><p key={itemIndex}><b>{item.decision}</b><small>{item.evidence}</small></p>):<p className="muted">No explicit decisions found in the available messages.</p>}<span className="eyebrow">UNRESOLVED QUESTIONS</span><ul>{summary.unresolvedQuestions.map((item,itemIndex)=><li key={itemIndex}>{item}</li>)}</ul><span className="eyebrow">NEXT STEPS</span><ul>{summary.nextSteps.map((item,itemIndex)=><li key={itemIndex}>{item}</li>)}</ul>{summary.suggestedTasks.length>0&&<><span className="eyebrow">SUGGESTED TASKS · NOT SAVED</span>{summary.suggestedTasks.map((task,itemIndex)=><p key={itemIndex}><b>{task.title}</b><small>{task.description}</small></p>)}</>}</div>}</section>}
  </div>;
}




