import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const WorkspaceContext = createContext(null);
export function WorkspaceProvider({ children }) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['workspaces'], queryFn: () => api.get('/workspaces') });
  const items = data?.items || []; const [selectedId, setSelectedId] = useState(localStorage.getItem('teamforge-workspace') || '');
  const selected = items.find(item => item._id === selectedId) || items[0] || null;
  useEffect(() => { if (selected?._id) { setSelectedId(selected._id); localStorage.setItem('teamforge-workspace', selected._id); } }, [selected?._id]);
  const value = useMemo(() => ({ items, selected, selectedId: selected?._id || '', setSelectedId, isLoading, refresh: refetch }), [items, selected, selectedId, isLoading, refetch]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
export const useWorkspace = () => useContext(WorkspaceContext);
