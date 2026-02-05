'use client'

import React, { useState, createContext, useContext, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bell,
  Heart,
  MessageCircle,
  Send,
  TrendingUp,
  Users,
  Star,
  Trophy,
  ShoppingBag,
  Settings,
  UserPlus,
  Crown,
  Medal,
  Rocket,
  Edit,
  Share2,
  User,
  Mail,
  ThumbsUp,
  MessageSquare,
  RotateCcw,
  Users as UsersIcon,
  Award,
  TrendingDown,
  Search,
  UserCheck,
  UserMinus,
  Plus,
  CheckFollow,
  X,
  Eye,
  Timer,
  Target,
  BarChart,
  Zap as ZapIcon
} from 'lucide-react'

import { useToast } from '@/hooks/use-toast'

// Social Network Context
interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatar: string | null
  bio: string
  isVerified: boolean
  isVIP: boolean
  followersCount: number
  followingCount: number
  totalTrades: number
  winRate: number
  portfolioValue: number
  totalPNL: number
  streakDays: number
  level: number
  experience: number
  achievements: Achievement[]
  badges: Badge[]
  createdAt: Date
  lastActive: Date
}

interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockedAt: Date
}

interface Badge {
  id: string
  title: string
  description: string
  color: string
}

interface Post {
  id: string
  author: User
  content: string
  strategy?: string
  trade?: Trade
  images?: string[]
  createdAt: Date
  likes: number
  comments: number
  shares: number
  isLiked: boolean
}

interface Trade {
  pair: string
  direction: 'buy' | 'sell'
  amount: number
  price: number
  pnl?: number
  timestamp: Date
}

interface Message {
  id: string
  from: User
  to: User
  content: string
  timestamp: Date
  read: boolean
}

interface SocialContextType {
  currentUser: User | null
  users: User[]
  posts: Post[]
  messages: Message[]
  followers: string[]
  following: string[]
  searchUsers: (query: string) => User[]
  followUser: (userId: string) => void
  unfollowUser: (userId: string) => void
  sendMessage: (toUserId: string, content: string) => void
  createPost: (content: string, trade?: Trade, images?: string[]) => void
  likePost: (postId: string) => void
}

const SocialContext = createContext<SocialContextType | null>(null)

export const useSocialContext = () => {
  const context = useContext(SocialContext)
  if (!context) {
    throw new Error('useSocialContext must be used within SocialProvider')
  }
  return context
}

interface LeftSocialSidebarProps {
  isOpen: boolean
  toggleSidebar: () => void
}

// Mock data for social network
const createMockUsers = (): User[] => [
  {
    id: '1',
    username: 'CryptoKing',
    displayName: 'Crypto King',
    email: 'cryptoking@example.com',
    avatar: null,
    bio: 'Professional crypto trader | Momentum Strategy Expert | 1500+ wins',
    isVerified: true,
    isVIP: true,
    followersCount: 12400,
    followingCount: 234,
    totalTrades: 8765,
    winRate: 78.3,
    portfolioValue: 450000,
    totalPNL: 250000,
    streakDays: 15,
    level: 42,
    experience: 85400,
    achievements: [
      { id: 'momentum-master', title: 'Momentum Master', description: '+100% this month', icon: '🚀', rarity: 'legendary', unlockedAt: new Date(Date.now() - 86400000 * 2) },
      { id: 'top-performer', title: 'Top Performer', description: '#1 ranked trader', icon: '🏆', rarity: 'epic', unlockedAt: new Date(Date.now() - 86400000 * 5) }
    ],
    badges: [
      { id: 'legendary-trader', title: 'Legendary Trader', description: '80%+ win rate', color: 'bg-yellow-500' },
      { id: 'verified-pro', title: 'Verified Pro', description: 'Industry expert', color: 'bg-blue-500' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 365),
    lastActive: new Date(Date.now() - 3600000 * 2)
  },
  {
    id: '2',
    username: 'AlicePro',
    displayName: 'Alice Professional',
    email: 'alice@example.com',
    avatar: null,
    bio: 'Scalping expert | Day trading specialist | Teaching others to trade',
    isVerified: true,
    isVIP: false,
    followersCount: 8900,
    followingCount: 145,
    totalTrades: 5432,
    winRate: 65.8,
    portfolioValue: 125000,
    totalPNL: 75000,
    streakDays: 8,
    level: 28,
    experience: 45600,
    achievements: [
      { id: 'scalping-expert', title: 'Scalping Expert', description: '500+ scalps', icon: '⚡', rarity: 'rare', unlockedAt: new Date(Date.now() - 86400000 * 12) }
    ],
    badges: [
      { id: 'verified-educator', title: 'Verified Educator', description: 'Trading instructor', color: 'bg-purple-500' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 240),
    lastActive: new Date(Date.now() - 600000)
  },
  {
    id: '3',
    username: 'SolanaWhale',
    displayName: 'SOL Whale Trader',
    email: 'solwhale@example.com',
    avatar: null,
    bio: 'Solana ecosystem specialist | Large position trader | DeFi maximalist',
    isVerified: true,
    isVIP: true,
    followersCount: 8900,
    followingCount: 567,
    totalTrades: 1234,
    winRate: 72.1,
    portfolioValue: 750000,
    totalPNL: 420000,
    streakDays: 22,
    level: 38,
    experience: 72300,
    achievements: [
      { id: 'defi-pioneer', title: 'DeFi Pioneer', description: '$500K+ portfolio', icon: '🌊', rarity: 'legendary', unlockedAt: new Date(Date.now() - 86400000 * 7) }
    ],
    badges: [
      { id: 'vip-trader', title: 'VIP Trader', description: 'Premium member', color: 'bg-gold-500' },
      { id: 'solana-expert', title: 'SOL Expert', description: 'Solana specialist', color: 'bg-purple-500' }
    ],
    createdAt: new Date(Date.now() - 86400000 * 180),
    lastActive: new Date(Date.now() - 900000)
  }
]

const createMockPosts = (users: User[]): Post[] => [
  {
    id: '1',
    author: users[0],
    content: 'Just nailed a 300% gain on SOL/USDC in under 2 hours! HODL is dead, momentum trading is alive! 🚀',
    strategy: 'Momentum Trading',
    trade: { pair: 'SOL/USDC', direction: 'buy', amount: 1000, price: 98.42, pnl: 3000, timestamp: new Date(Date.now() - 300000) },
    images: [],
    createdAt: new Date(Date.now() - 300000),
    likes: 23,
    comments: 8,
    shares: 5,
    isLiked: false
  },
  {
    id: '2',
    author: users[1],
    content: 'New scalping strategy uploaded to my profile! Teaching my students the secrets of consistent small wins. 📈',
    strategy: 'Scalping 101',
    createdAt: new Date(Date.now() - 720000),
    likes: 15,
    comments: 12,
    shares: 3,
    isLiked: false
  },
  {
    id: '3',
    author: users[2],
    content: 'Market analysis: SOL trending upward with strong support at $95. Expecting breakout to $120 soon. Whale is loading up! 🐳',
    trade: { pair: 'SOL/USDC', direction: 'buy', amount: 50000, price: 97.8, timestamp: new Date(Date.now() - 1800000) },
    createdAt: new Date(Date.now() - 1800000),
    likes: 41,
    comments: 15,
    shares: 12,
    isLiked: true
  }
]

const createMockMessages = (users: User[]): Message[] => [
  {
    id: '1',
    from: users[1],
    to: users[0],
    content: 'Hey, could you share more about your momentum entry strategy?',
    timestamp: new Date(Date.now() - 3600000),
    read: false
  },
  {
    id: '2',
    from: users[2],
    to: users[0],
    content: 'Thanks for following! Want to collaborate on some JUP/JTO trades?',
    timestamp: new Date(Date.now() - 7200000),
    read: true
  }
]

// Social Network Provider
export const SocialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users] = useState<User[]>(createMockUsers())
  const [posts, setPosts] = useState<Post[]>(createMockPosts(users))
  const [messages, setMessages] = useState<Message[]>(createMockMessages(users))
  const [followers, setFollowers] = useState<string[]>(['1', '2'])
  const [following, setFollowing] = useState<string[]>(['1', '3'])

  // Mock current user (would normally come from auth)
  const currentUser = users[0] // CryptoKing is the current user

  const searchUsers = (query: string): User[] => {
    return users.filter(user =>
      user.username.toLowerCase().includes(query.toLowerCase()) ||
      user.displayName.toLowerCase().includes(query.toLowerCase())
    )
  }

  const followUser = (userId: string) => {
    if (!following.includes(userId)) {
      setFollowing(prev => [...prev, userId])
    }
  }

  const unfollowUser = (userId: string) => {
    setFollowing(prev => prev.filter(id => id !== userId))
  }

  const sendMessage = (toUserId: string, content: string) => {
    const toUser = users.find(u => u.id === toUserId)
    if (toUser) {
      const newMessage: Message = {
        id: Date.now().toString(),
        from: currentUser!,
        to: toUser,
        content,
        timestamp: new Date(),
        read: false
      }
      setMessages(prev => [...prev, newMessage])
    }
  }

  const createPost = (content: string, trade?: Trade, images?: string[]) => {
    const newPost: Post = {
      id: Date.now().toString(),
      author: currentUser!,
      content,
      trade,
      images,
      createdAt: new Date(),
      likes: 0,
      comments: 0,
      shares: 0,
      isLiked: false
    }
    setPosts(prev => [newPost, ...prev])
  }

  const likePost = (postId: string) => {
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? {
            ...post,
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          }
        : post
    ))
  }

  // Auto-generate posts every 5 minutes for demo
  useEffect(() => {
    const interval = setInterval(() => {
      const randomUser = users[Math.floor(Math.random() * users.length)]
      const tradeTemplates = [
        `Executed perfect ${Math.random() > 0.5 ? 'buy' : 'sell'} order at optimal entry point! 📈`,
        `Strong breakout signal confirmed. Position opened successfully.`,
        `Market analysis: ${['uptrend', 'correction', 'accumulation'][Math.floor(Math.random() * 3)]} period detected.`,
        `Just completed a ${Math.round(Math.random() * 200 + 50)}% profit trade! 🎯`
      ]

      const content = tradeTemplates[Math.floor(Math.random() * tradeTemplates.length)]
      const newPost: Post = {
        id: Date.now().toString(),
        author: randomUser,
        content,
        createdAt: new Date(),
        likes: Math.floor(Math.random() * 20) + 1,
        comments: Math.floor(Math.random() * 10),
        shares: Math.floor(Math.random() * 5),
        isLiked: false
      }

      setPosts(prev => [newPost, ...prev])
    }, 300000) // Every 5 minutes

    return () => clearInterval(interval)
  }, [users])

  const value: SocialContextType = {
    currentUser,
    users,
    posts,
    messages,
    followers,
    following,
    searchUsers,
    followUser,
    unfollowUser,
    sendMessage,
    createPost,
    likePost
  }

  return (
    <SocialContext.Provider value={value}>
      {children}
    </SocialContext.Provider>
  )
}

export function LeftSocialSidebar({ isOpen, toggleSidebar }: LeftSocialSidebarProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'social' | 'notifications'>('profile')
  const [searchQuery, setSearchQuery] = useState('')
  const [newPostContent, setNewPostContent] = useState('')

  const { currentUser, users, posts, messages, following, followUser, unfollowUser,
         sendMessage, createPost, likePost } = useSocialContext()

  const searchedUsers = searchQuery ? users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  ) : users.slice(0, 6) // Show top 6 users

  // Create post handler
  const handleCreatePost = () => {
    if (newPostContent.trim()) {
      createPost(newPostContent.trim())
      setNewPostContent('')
    }
  }

  // Generate notifications from real data
  const generateNotifications = () => {
    const notifications = []
    const unreadMessages = messages.filter(m => !m.read && m.to.id === currentUser?.id)
    const recentLikes = posts.filter(p => p.likes > 20).slice(0, 2) // Mock likes
    const recentFollows = following.slice(0, 2)

    unreadMessages.forEach(msg => {
      notifications.push({
        id: msg.id,
        type: 'message' as const,
        content: `New message from ${msg.from.displayName}`,
        time: `${Math.floor((Date.now() - msg.timestamp.getTime()) / 60000)}m ago`,
        unread: true
      })
    })

    recentLikes.forEach(post => {
      notifications.push({
        id: `like-${post.id}`,
        type: 'like' as const,
        content: `Your post about ${post.strategy || 'trading'} got ${post.likes} likes`,
        time: `${Math.floor((Date.now() - post.createdAt.getTime()) / 60000)}m ago`,
        unread: Math.random() > 0.5
      })
    })

    recentFollows.forEach(userId => {
      const user = users.find(u => u.id === userId)
      if (user) {
        notifications.push({
          id: `follow-${userId}`,
          type: 'follow' as const,
          content: `${user.displayName} started following you`,
          time: 'New follower',
          unread: true
        })
      }
    })

    return notifications.slice(0, 8)
  }

  const notifications = generateNotifications()

  if (!isOpen) return null

  return (
    <aside className="fixed left-0 top-0 h-full w-80 bg-black/95 backdrop-blur-md border-r border-white/10 z-40 overflow-y-auto overflow-x-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400" />
            Social DEX
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="text-white hover:bg-white/10"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'profile', label: 'Profile', icon: '👤' },
          { id: 'social', label: 'Social', icon: '🌐' },
          { id: 'notifications', label: 'Alerts', icon: '🔔' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 p-3 text-sm font-medium transition-all duration-200 hover:bg-white/5 ${
              activeTab === tab.id
                ? 'bg-blue-500/20 border-b-2 border-blue-500 text-blue-300'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </div>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-4 overflow-y-auto">

        {/* Profile Tab */}
        {activeTab === 'profile' && currentUser && (
          <div className="space-y-6">
            {/* User Profile Card */}
            <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-white/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-blue-400 flex items-center justify-center text-white text-lg font-bold">
                      {currentUser.displayName[0]}
                    </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{currentUser.displayName}</h3>
                      {currentUser.isVerified && <Crown className="w-4 h-4 text-yellow-400" />}
                      {currentUser.isVIP && (
                        <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs">
                          VIP
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        {currentUser.badges.map((badge) => (
                          <div key={badge.id} className={`w-3 h-3 rounded-full ${badge.color}`} title={badge.description} />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-400 text-sm">@{currentUser.username}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-green-400 text-sm flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Win Rate: {currentUser.winRate}%
                      </p>
                      <Badge className="text-xs bg-blue-500/20 text-blue-400">
                        Level {currentUser.level}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">{currentUser.bio}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{currentUser.followersCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">{currentUser.followingCount}</div>
                    <div className="text-xs text-gray-400">Following</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Trades</span>
                    <span className="text-white font-semibold">{currentUser.totalTrades}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Portfolio Value</span>
                    <span className="text-green-400 font-semibold">${currentUser.portfolioValue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total PNL</span>
                    <span className="text-green-400 font-semibold">+${currentUser.totalPNL.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Win Streak</span>
                    <span className="text-orange-400 font-semibold">{currentUser.streakDays} days</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                      style={{ width: `${(currentUser.experience % 1000) / 10}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center">{currentUser.experience} / {(Math.floor(currentUser.experience / 1000) + 1) * 1000} XP</div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600">
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
              <Button variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white">
                <Share2 className="w-4 h-4 mr-2" />
                Share Profile
              </Button>
            </div>

            {/* Achievements */}
            <Card className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border-yellow-400/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-yellow-400 text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  Achievements ({currentUser.achievements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentUser.achievements.map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3">
                    <span className="text-lg">{achievement.icon}</span>
                    <div className="flex-1">
                      <div className="text-white font-medium text-sm">{achievement.title}</div>
                      <div className="text-gray-400 text-xs">{achievement.description}</div>
                      <div className="text-gray-500 text-xs">
                        {achievement.rarity === 'legendary' && '🔥 Legendary'}
                        {achievement.rarity === 'epic' && '💎 Epic'}
                        {achievement.rarity === 'rare' && '💫 Rare'}
                        {achievement.rarity === 'common' && '📘 Common'}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Social Tab */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            {/* Create Post */}
            <Card className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-blue-400/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Share Your Trade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  placeholder="Share your trading insights, strategy, or recent wins..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full p-3 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-blue-400/50 resize-none"
                  rows={3}
                />
                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2">
                    <span className="text-xs text-gray-400">💡 Tip: Tag @mention or #hashtag</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600"
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Post
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Discover Users */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-400/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Discover Traders ({searchedUsers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search traders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:border-purple-400/50"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  {searchedUsers.slice(0, 5).map((user) => {
                    const isFollowing = following.includes(user.id)
                    return (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-black/50 hover:bg-black/70 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-blue-400 flex items-center justify-center text-white text-sm font-medium">
                            {user.displayName[0]}
                          </div>
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="text-white text-sm font-medium">{user.displayName}</span>
                              {user.isVerified && <Crown className="w-3 h-3 text-yellow-400" />}
                              {user.isVIP && <Badge className="text-xs bg-yellow-500/20 text-yellow-400">VIP</Badge>}
                            </div>
                            <div className="text-gray-400 text-xs">@{user.username} • {user.winRate}% win rate</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendMessage(user.id, `Hey ${user.displayName}, I admire your trading!`)}
                            className="text-xs border-gray-400/50 text-gray-400 hover:bg-gray-400 hover:text-black"
                          >
                            <Mail className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => isFollowing ? unfollowUser(user.id) : followUser(user.id)}
                            className={`text-xs ${
                              isFollowing
                                ? 'border-red-400/50 text-red-400 hover:bg-red-400 hover:text-white'
                                : 'border-green-400/50 text-green-400 hover:bg-green-400 hover:text-white'
                            }`}
                          >
                            {isFollowing ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Social Feed */}
            <Card className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-400/30">
              <CardHeader>
                <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Social Feed ({posts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {posts.slice(0, 10).map((post) => (
                  <div key={post.id} className="p-4 rounded-lg bg-black/50 border border-white/5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-blue-400 flex items-center justify-center text-white text-sm font-medium">
                        {post.author.displayName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-sm font-medium">{post.author.displayName}</span>
                          {post.author.isVerified && <Crown className="w-3 h-3 text-yellow-400" />}
                          <span className="text-gray-400 text-xs">
                            {new Date(Date.now() - post.createdAt.getTime()).getMinutes() <= 1 ? 'now' : `${new Date(Date.now() - post.createdAt.getTime()).getMinutes()}m ago`}
                          </span>
                        </div>

                        {post.strategy && (
                          <Badge className="text-xs bg-purple-500/20 text-purple-400 mb-2">
                            📊 {post.strategy}
                          </Badge>
                        )}

                        <p className="text-gray-300 text-sm mb-3">{post.content}</p>

                        {post.trade && (
                          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded mb-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-green-400 text-sm font-medium">{post.trade.pair}</span>
                              <Badge className={post.trade.direction === 'buy' ? 'bg-green-500' : 'bg-red-500'}>
                                {post.trade.direction.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-400">
                              Amount: {post.trade.amount} @ ${post.trade.price}
                              {post.trade.pnl && (
                                <span className={post.trade.pnl > 0 ? "text-green-400" : "text-red-400"}>
                                  {" "}• PNL: {post.trade.pnl > 0 ? "+" : ""}${post.trade.pnl}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => likePost(post.id)}
                              className={`flex items-center gap-1 text-xs ${
                                post.isLiked
                                  ? 'text-red-400'
                                  : 'text-gray-400 hover:text-red-400'
                              }`}
                            >
                              <Heart className={`w-3 h-3 ${post.isLiked ? 'fill-current' : ''}`} />
                              {post.likes}
                            </button>
                            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-400">
                              <MessageSquare className="w-3 h-3" />
                              {post.comments}
                            </button>
                            <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-purple-400">
                              <Send className="w-3 h-3" />
                              {post.shares}
                            </button>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs text-gray-400 hover:text-white">
                            More
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {posts.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No posts yet. Be the first to share your trading insights!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            {/* Recent Messages */}
            <Card className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border-blue-400/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-400 text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Messages ({messages.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className={`p-3 rounded-lg bg-black/50 border ${
                      message.read ? 'border-white/5' : 'border-blue-400/30 bg-blue-900/20'
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-blue-400 flex items-center justify-center text-white text-sm font-medium">
                          {message.from.displayName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-sm font-medium">{message.from.displayName}</span>
                            <span className="text-gray-400 text-xs">
                              {new Date(Date.now() - message.timestamp.getTime()).getMinutes() <= 1 ? 'now' : `${new Date(Date.now() - message.timestamp.getTime()).getMinutes()}m ago`}
                            </span>
                            {!message.read && (
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm truncate">{message.content}</p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white">
                          Reply
                        </Button>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No messages yet. Start connecting with traders!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-400/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications ({notifications.filter(n => n.unread).length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg transition-all duration-200 ${
                      notification.unread
                        ? 'bg-blue-900/30 border-l-4 border-blue-400'
                        : 'bg-black/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-1 rounded-full ${
                        notification.type === 'like' ? 'bg-red-500/20 text-red-400' :
                        notification.type === 'follow' ? 'bg-green-500/20 text-green-400' :
                        notification.type === 'trade' ? 'bg-yellow-500/20 text-yellow-400' :
                        notification.type === 'achievement' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {notification.type === 'like' && <Heart className="w-3 h-3" />}
                        {notification.type === 'follow' && <UserPlus className="w-3 h-3" />}
                        {notification.type === 'trade' && <TrendingUp className="w-3 h-3" />}
                        {notification.type === 'message' && <MessageCircle className="w-3 h-3" />}
                        {notification.type === 'achievement' && <Trophy className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">{notification.content}</p>
                        <p className="text-gray-400 text-xs mt-1">{notification.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </aside>
  )
}
