'use client'

// src/components/PhotoInput.tsx
// Composant photo partagé : upload fichier OU saisie d'URL externe
// → Upload = stockage Supabase (eleves-photos)
// → URL    = lien externe, 0 stockage utilisé

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/contexts/ToastContext'
import { Upload, Link as LinkIcon, Loader2, User, Camera, X } from 'lucide-react'

interface Props {
  value: string          // URL actuelle (vide si aucune)
  onChange: (url: string) => void
  /** ID unique pour le path Supabase (ex: id d'élève ou timestamp) */
  storageId: string
}

type Mode = 'upload' | 'url'

export default function PhotoInput({ value, onChange, storageId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('upload')
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState(value && !value.includes('supabase') ? value : '')

  const hasPhoto = Boolean(value)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `photos/${storageId}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('eleves-photos')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('eleves-photos')
        .getPublicUrl(path)

      onChange(publicUrl)
      showToast('Photo uploadée !', 'success')
    } catch (err: any) {
      showToast("Erreur lors de l'upload : " + (err.message ?? err), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleUrlConfirm() {
    const url = urlInput.trim()
    if (!url) return
    // Validation basique
    try { new URL(url) } catch { showToast('URL invalide.', 'error'); return }
    onChange(url)
    showToast('URL de photo enregistrée.', 'success')
  }

  function clearPhoto() {
    onChange('')
    setUrlInput('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* Avatar preview */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-200 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center group">
          {uploading ? (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          ) : value ? (
            <>
              <img src={value} alt="Photo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </>
          ) : (
            <User className="w-10 h-10 text-white opacity-70" />
          )}
        </div>

        {/* Bouton effacer */}
        {hasPhoto && !uploading && (
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
            title="Supprimer la photo"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex items-center bg-slate-100 rounded-xl p-0.5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            mode === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          Fichier
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
            mode === 'url' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          URL externe
        </button>
      </div>

      {/* Panel selon le mode */}
      {mode === 'upload' ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</>
          ) : (
            <><Upload className="w-4 h-4" /> {value ? 'Changer la photo' : 'Choisir un fichier'}</>
          )}
        </button>
      ) : (
        <div className="flex gap-2 w-full max-w-xs">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleUrlConfirm())}
            placeholder="https://exemple.com/photo.jpg"
            className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleUrlConfirm}
            disabled={!urlInput.trim()}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-xl disabled:opacity-40 transition-colors"
          >
            OK
          </button>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        {mode === 'upload'
          ? 'Le fichier sera stocké dans Supabase (eleves-photos)'
          : 'Aucun stockage utilisé — la photo est hébergée ailleurs'}
      </p>
    </div>
  )
}
