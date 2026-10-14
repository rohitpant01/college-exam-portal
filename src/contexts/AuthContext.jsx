import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error.message)
        setProfile(null)
        return null
      }

      setProfile(data)
      return data
    } catch (err) {
      console.error('Unexpected error fetching profile:', err)
      setProfile(null)
      return null
    }
  }

  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        setLoading(true)
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error

        if (session?.user && isMounted) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Error during auth initialization:', err)
        if (isMounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email, password, fullName, enrollmentNo) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          enrollment_no: enrollmentNo,
        },
      },
    })

    if (error) throw error

    if (data?.user) {
      const newProfile = {
        id: data.user.id,
        full_name: fullName,
        email: email,
        role: 'student',
        enrollment_no: enrollmentNo || null,
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(newProfile)

      if (profileError) {
        console.error('Error creating profile:', profileError.message)
        throw profileError
      }

      setUser(data.user)
      setProfile(newProfile)
    }

    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    if (data?.user) {
      setUser(data.user)
      await fetchProfile(data.user.id)
    }

    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
