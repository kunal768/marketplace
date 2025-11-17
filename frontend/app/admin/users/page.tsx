"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { orchestratorApi } from "@/lib/api/orchestrator"
import type { User } from "@/lib/api/types"
import { useToast } from "@/hooks/use-toast"
import { Search, ArrowLeft, Edit, Trash2, Mail, Calendar, User as UserIcon, Shield, AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function AdminUsersPage() {
  const router = useRouter()
  const { user: authUser, token, isAuthenticated, isHydrated } = useAuth()
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editUserName, setEditUserName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editContactEmail, setEditContactEmail] = useState("")
  const [updating, setUpdating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRefreshToken(localStorage.getItem("frontend-refreshToken"))
    }
  }, [])

  // Check if user is admin and redirect if not
  useEffect(() => {
    if (isHydrated) {
      if (!isAuthenticated) {
        router.push("/")
        return
      }
      if (authUser?.role !== "0") {
        router.push("/home")
        return
      }
    }
  }, [isHydrated, isAuthenticated, authUser, router])

  // Search users
  const handleSearch = useCallback(async () => {
    if (!token || !refreshToken || !searchQuery.trim()) {
      return
    }

    try {
      setSearching(true)
      setError(null)
      const response = await orchestratorApi.searchUsers(token, refreshToken, searchQuery.trim())
      setUsers(response.users || [])
    } catch (err) {
      console.error("Error searching users:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to search users"
      setError(errorMessage)
      toast({
        title: "Search Failed",
        description: errorMessage,
        variant: "destructive",
      })
      setUsers([])
    } finally {
      setSearching(false)
      setLoading(false)
    }
  }, [token, refreshToken, searchQuery, toast])

  // Handle search on Enter key
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // View user details
  const handleViewUser = async (userId: string) => {
    if (!token || !refreshToken) return

    try {
      setError(null)
      const user = await orchestratorApi.getUserById(token, refreshToken, userId)
      setSelectedUser(user)
      setViewDialogOpen(true)
    } catch (err) {
      console.error("Error fetching user:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch user"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // Open edit dialog
  const handleOpenEditDialog = (user: User) => {
    setSelectedUser(user)
    setEditUserName(user.user_name)
    setEditEmail(user.email)
    setEditContactEmail(user.contact?.Email || user.email)
    setEditDialogOpen(true)
  }

  // Update user
  const handleUpdateUser = async () => {
    if (!selectedUser || !token || !refreshToken) return

    // Validate email format
    if (!editEmail.endsWith("@sjsu.edu")) {
      toast({
        title: "Validation Error",
        description: "Email must be a valid @sjsu.edu address",
        variant: "destructive",
      })
      return
    }

    if (!editContactEmail.endsWith("@sjsu.edu")) {
      toast({
        title: "Validation Error",
        description: "Contact email must be a valid @sjsu.edu address",
        variant: "destructive",
      })
      return
    }

    if (editUserName.trim().length < 3 || editUserName.trim().length > 50) {
      toast({
        title: "Validation Error",
        description: "Username must be between 3 and 50 characters",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdating(true)
      setError(null)

      const response = await orchestratorApi.updateUser(token, refreshToken, {
        user_id: selectedUser.user_id,
        user_name: editUserName.trim(),
        email: editEmail.trim(),
        contact: {
          Email: editContactEmail.trim(),
        },
      })

      // Update user in list
      setUsers((prev) => prev.map((u) => (u.user_id === selectedUser.user_id ? response.user : u)))

      toast({
        title: "User Updated",
        description: "User profile has been updated successfully.",
      })

      setEditDialogOpen(false)
      setSelectedUser(null)
    } catch (err) {
      console.error("Error updating user:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to update user"
      setError(errorMessage)
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setUpdating(false)
    }
  }

  // Delete user
  const handleDeleteUser = async () => {
    if (!selectedUser || !token || !refreshToken) return

    try {
      setDeleting(true)
      setError(null)

      await orchestratorApi.deleteUser(token, refreshToken, selectedUser.user_id)

      // Remove user from list
      setUsers((prev) => prev.filter((u) => u.user_id !== selectedUser.user_id))

      toast({
        title: "User Deleted",
        description: "User has been deleted successfully.",
      })

      setDeleteDialogOpen(false)
      setSelectedUser(null)
    } catch (err) {
      console.error("Error deleting user:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to delete user"
      setError(errorMessage)
      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch {
      return dateString
    }
  }

  // Get user initials
  const getUserInitials = (userName: string) => {
    return userName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || authUser?.role !== "0") {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-float-in-up">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/admin/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <UserIcon className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">User Management</h1>
                <p className="text-lg text-muted-foreground">Search, view, edit, and delete user accounts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search Card */}
        <Card className="mb-8 animate-float-in-up">
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>Search for users by user ID, username, or email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter user ID, username, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                {searching ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users List */}
        {users.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-float-in-up">
            {users.map((user, index) => (
              <Card
                key={user.user_id}
                className="premium-card hover:shadow-lg transition-all duration-300 animate-float-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src="/placeholder-user.jpg" />
                      <AvatarFallback className="text-lg">{getUserInitials(user.user_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{user.user_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        {user.role === "0" ? (
                          <Badge variant="default" className="bg-purple-500">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {user.created_at && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Joined {formatDate(user.created_at)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleViewUser(user.user_id)}
                    >
                      <UserIcon className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEditDialog(user)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedUser(user)
                        setDeleteDialogOpen(true)
                      }}
                      disabled={user.user_id === authUser?.user_id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          !loading &&
          searchQuery && (
            <Card className="animate-float-in-up">
              <CardContent className="py-12 text-center">
                <UserIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No users found</p>
                <p className="text-sm text-muted-foreground mt-2">Try a different search query</p>
              </CardContent>
            </Card>
          )
        )}

        {!searchQuery && (
          <Card className="animate-float-in-up">
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">Enter a search query to find users</p>
              <p className="text-sm text-muted-foreground mt-2">Search by user ID, username, or email</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* View User Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>View user profile information</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback className="text-xl">{getUserInitials(selectedUser.user_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{selectedUser.user_name}</h3>
                  {selectedUser.role === "0" ? (
                    <Badge variant="default" className="bg-purple-500 mt-1">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="mt-1">
                      User
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="text-sm font-mono">{selectedUser.user_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="text-sm">{selectedUser.email}</p>
                </div>
                {selectedUser.contact?.Email && (
                  <div>
                    <Label className="text-muted-foreground">Contact Email</Label>
                    <p className="text-sm">{selectedUser.contact.Email}</p>
                  </div>
                )}
                {selectedUser.created_at && (
                  <div>
                    <Label className="text-muted-foreground">Joined</Label>
                    <p className="text-sm">{formatDate(selectedUser.created_at)}</p>
                  </div>
                )}
                {selectedUser.updated_at && (
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="text-sm">{formatDate(selectedUser.updated_at)}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            {selectedUser && (
              <Button onClick={() => handleOpenEditDialog(selectedUser)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="Enter username"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be between 3 and 50 characters</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="your.email@sjsu.edu"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be a valid @sjsu.edu address</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-contact-email">Contact Email</Label>
              <Input
                id="edit-contact-email"
                type="email"
                value={editContactEmail}
                onChange={(e) => setEditContactEmail(e.target.value)}
                placeholder="contact.email@sjsu.edu"
                disabled={updating}
              />
              <p className="text-xs text-muted-foreground">Must be a valid @sjsu.edu address</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={updating}>
              {updating ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete this user? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <Avatar className="h-10 w-10">
                  <AvatarImage src="/placeholder-user.jpg" />
                  <AvatarFallback>{getUserInitials(selectedUser.user_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedUser.user_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={deleting}>
              {deleting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

