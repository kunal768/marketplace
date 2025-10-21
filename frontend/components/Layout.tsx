import React from 'react'

const Sidebar: React.FC = () => {
  return <aside className="sidebar">Sidebar</aside>
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  )
}

export default Layout
