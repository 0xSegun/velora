'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ChevronLeft, ChevronRight, UserPlus, Users } from 'lucide-react';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { CountryFlag, CountryLabel } from '@/components/ui/CountryFlag';
import EmptyState from '@/components/ui/EmptyState';

interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  country: string;
  country_name?: string;
  country_flag?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 8;

  useEffect(() => {
    void adminAPI
      .getUsers({ page: 1, per_page: 100 })
      .then(({ data }) => {
        const payload = data as { users?: AdminUser[] };
        setUsers(payload.users ?? []);
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const matchRole = roleFilter === 'all' || user.role === roleFilter;
      const matchSearch =
        searchQuery === '' ||
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.country_name ?? user.country).toLowerCase().includes(searchQuery.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [users, searchQuery, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageUsers = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (!loading && users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No users found"
        description="Registered users will appear here once accounts are created on the platform."
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-muted)]">Manage platform accounts and roles.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)]">
          <UserPlus size={16} /> Invite user
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full glass-card rounded-xl hover:transform-none py-2 pl-9 pr-4 text-sm text-[var(--text-primary)]"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="glass-card rounded-xl hover:transform-none py-2 pl-9 pr-8 text-sm text-[var(--text-primary)]"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="analyst">Analyst</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border-primary)]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-[var(--border-primary)] bg-[var(--accent-faint)] text-xs uppercase tracking-wider text-[var(--text-faint)]">
            <tr>
              <th className="px-4 py-3">Profile</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">
                  Loading users...
                </td>
              </tr>
            ) : (
              pageUsers.map((user) => (
                <tr key={user.id} className="border-b border-[var(--border-primary)] last:border-0">
                  <td className="px-4 py-3">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-faint)] text-xs font-bold text-[var(--text-primary)]">
                        {user.full_name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{user.full_name}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{user.email}</td>
                  <td className="px-4 py-3">
                    <CountryLabel
                      code={user.country}
                      name={user.country_name}
                      flagSize="sm"
                      nameClassName="text-sm text-[var(--text-secondary)]"
                    />
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{user.role}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {user.is_active ? 'Active' : 'Inactive'}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(user.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-faint)]">
          Showing {pageUsers.length} of {filtered.length} users
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="rounded-lg border border-[var(--border-primary)] p-2 disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="rounded-lg border border-[var(--border-primary)] p-2 disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}