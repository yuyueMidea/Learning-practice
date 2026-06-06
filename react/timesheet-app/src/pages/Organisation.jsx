import { useState } from 'react';
import AppShell from '../components/AppShell';
import PageHead from '../components/PageHead';
import { ORG_EMPLOYEES } from '../data/mockData';

// ─── 树形数据（可从 mockData.js 移出统一管理） ────────────────────────────────
const ORG_TREE = [
  {
    id: 'pccw',
    label: 'PCCW Group',
    children: [
      {
        id: 'tech',
        label: 'Technology',
        children: [
          {
            id: 'itd',
            label: 'IT Delivery',
            children: [
              { id: 'appdev', label: 'Application Development', children: [] },
              { id: 'qa',     label: 'QA Team',                 children: [] },
              { id: 'support',label: 'Support',                 children: [] },
            ],
          },
        ],
      },
      { id: 'finance', label: 'Finance', children: [] },
      { id: 'hr',      label: 'HR',      children: [] },
    ],
  },
];

// ─── 递归树节点组件 ───────────────────────────────────────────────────────────
function TreeNode({ node, selectedId, onSelect, defaultOpen = false }) {
  const hasChildren = node.children && node.children.length > 0;
  const [open, setOpen] = useState(defaultOpen);
  const isSelected = node.id === selectedId;

  return (
    <li>
      <div
        className="tree-node"
        data-selected={isSelected || undefined}
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
          onSelect(node);
        }}
      >
        <span className="tree-arrow">
          {hasChildren ? (open ? '▾' : '▸') : '·'}
        </span>
        {node.label}
      </div>

      {hasChildren && open && (
        <ul>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultOpen={child.id === 'itd'}   // IT Delivery 默认展开
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────
export default function Organisation() {
  const [selectedNode, setSelectedNode] = useState(
    // 默认选中 Application Development
    { id: 'appdev', label: 'Application Development' }
  );
  const [selectedEmployee, setSelectedEmployee] = useState(ORG_EMPLOYEES[0]);
  const [search, setSearch] = useState('');

  const filteredEmployees = ORG_EMPLOYEES.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHead
        title="Organisation & User Management"
        desc="Manage organisation units, reporting lines and system access."
        actions={<button className="btn primary">+ Add Employee</button>}
      />

      <div className="split">
        {/* ── 左：树形 ── */}
        <div className="tree">
          <h3>Organisation Tree</h3>
          <ul className="tree-root">
            {ORG_TREE.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                selectedId={selectedNode?.id}
                onSelect={setSelectedNode}
                defaultOpen
              />
            ))}
          </ul>
          <div className="sponsor-note">
            点击节点展开 / 收起，点击叶节点筛选右侧员工表。
          </div>
        </div>

        {/* ── 右：员工表 + 详情 ── */}
        <div>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Employees</h3>
                <div className="hint">
                  Department: {selectedNode?.label ?? 'All'}
                </div>
              </div>
              <div className="spacer" />
              <input
                className="input"
                style={{ width: 240 }}
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <br />
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Supervisor</th>
                  <th>Second-level</th>
                  <th>Roles</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((e, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedEmployee(e)}
                    style={{
                      cursor: 'pointer',
                      background:
                        selectedEmployee?.name === e.name ? '#f0f7ff' : undefined,
                    }}
                  >
                    <td>{e.name}</td>
                    <td>{e.email}</td>
                    <td>{e.supervisor}</td>
                    <td>{e.second}</td>
                    <td>{e.role}</td>
                    <td>
                      <span className="status approved">{e.status}</span>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#98a2b3' }}>
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <br />

          {/* 详情抽屉：点击员工行后填充 */}
          {selectedEmployee && (
            <div className="drawer">
              <h3>Employee Details</h3>
              <div className="grid two">
                <div className="field">
                  <label>Full Name</label>
                  <input className="input" defaultValue={selectedEmployee.name} key={selectedEmployee.name + '-name'} />
                </div>
                <div className="field">
                  <label>Company Email</label>
                  <input className="input" defaultValue={selectedEmployee.email} key={selectedEmployee.name + '-email'} />
                </div>
                <div className="field">
                  <label>Organisation Unit</label>
                  <select className="select">
                    <option>Application Development</option>
                    <option>QA Team</option>
                    <option>Finance</option>
                    <option>HR</option>
                  </select>
                </div>
                <div className="field">
                  <label>Direct Supervisor</label>
                  <select className="select" defaultValue={selectedEmployee.supervisor} key={selectedEmployee.name + '-sup'}>
                    <option>Mary Chan</option>
                    <option>David Lee</option>
                    <option>Henry Ng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Second-level Supervisor</label>
                  <select className="select" defaultValue={selectedEmployee.second} key={selectedEmployee.name + '-sup2'}>
                    <option>David Lee</option>
                    <option>Henry Ng</option>
                  </select>
                </div>
                <div className="field">
                  <label>Account Status</label>
                  <select className="select">
                    <option>Active</option>
                    <option>Suspended</option>
                  </select>
                </div>
              </div>
              <br />
              <div>
                <b>System Roles</b>
                <br />
                {['Employee', 'Supervisor', 'Project Manager', 'System Administrator'].map(
                  (role) => (
                    <label key={role} style={{ marginRight: 16 }}>
                      <input
                        type="checkbox"
                        defaultChecked={role === selectedEmployee.role}
                        key={selectedEmployee.name + role}
                      />{' '}
                      {role}
                    </label>
                  )
                )}
              </div>
              <br />
              <button className="btn primary">Save Changes</button>
            </div>
          )}
        </div>
      </div>

      {/* ── 树节点专属样式（局部，不污染全局） ── */}
      <style>{`
        .tree-root { list-style: none; margin: 0; padding: 0; }
        .tree-root ul { list-style: none; margin: 0; padding-left: 18px; }
        .tree-node {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 8px; border-radius: 8px;
          font-size: 14px; cursor: pointer;
          user-select: none; transition: background 0.15s;
        }
        .tree-node:hover { background: #f0f7ff; }
        .tree-node[data-selected] {
          background: #eaf4ff; color: #0b5cab; font-weight: 700;
        }
        .tree-arrow { width: 14px; text-align: center; font-size: 12px; color: #94a3b8; flex-shrink: 0; }
        .tree-node[data-selected] .tree-arrow { color: #0b5cab; }
      `}</style>
    </AppShell>
  );
}
