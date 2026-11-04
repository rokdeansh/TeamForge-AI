import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TaskDrawer from './TaskDrawer';

vi.mock('../services/api', () => ({ api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { api } from '../services/api';

const task = { _id: '507f1f77bcf86cd799439011', title: 'Plan release', description: 'Draft the release steps', status: 'To Do', priority: 'High', assignees: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' };

describe('TaskDrawer', () => {
  beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ items: [] }); api.patch.mockResolvedValue({ task }); });

  it('saves edited task fields through the API and notifies its parent', async () => {
    const onSaved = vi.fn();
    render(<TaskDrawer task={task} workspaceId="507f1f77bcf86cd799439012" onClose={vi.fn()} onSaved={onSaved} onDeleted={vi.fn()}/>);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Plan product release' } });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'In Progress' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/tasks/${task._id}`, expect.objectContaining({ title: 'Plan product release', status: 'In Progress' })));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('loads workspace members for assignment controls', async () => {
    render(<TaskDrawer task={task} workspaceId="workspace-id" onClose={vi.fn()} onSaved={vi.fn()} onDeleted={vi.fn()}/>);
    expect(await screen.findByText('Assignees')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/workspaces/workspace-id/members');
  });
});
