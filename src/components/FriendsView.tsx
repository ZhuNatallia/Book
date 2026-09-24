import { useState, useEffect, useCallback, useMemo } from 'react';
import { FullRecipe, FriendProfile } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { useTheme } from '../i18n/ThemeContext';
import { supabase } from '../lib/supabase';
import { fetchFriendVisibleRecipes } from '../lib/recipeDb';
import { recipeMatchesQuery } from '../lib/recipeSearch';
import { RecipeCard } from './RecipeCard';
import { RecipeFilterBar, RecipeStatusFilter } from './RecipeFilterBar';
import { RecipeLayout } from '../lib/recipeLayout';
import { AvatarBox } from './ProfileSettings';
import { UserPlus, Users, ArrowLeft, Loader2, Pencil, Search, Trash2, Share2, Copy, MessageSquare } from 'lucide-react';
import { CircleChips } from './VisibilityEye';
import {
  FRIEND_CIRCLES,
  FriendCircle,
  circleLabelKey,
  isFriendCircle,
} from '../lib/friendCircles';

interface FriendsViewProps {
  currentUserId: string;
  onOpenRecipe: (recipe: FullRecipe) => void;
  onCopyRecipe: (recipe: FullRecipe) => true | false | 'duplicate';
  onDiscardCopiedFromFriend: (friendId: string) => void;
  recipeLayout: RecipeLayout;
  onRecipeLayoutChange: (layout: RecipeLayout) => void;
  homeRequest: number;
}

function friendLabel(friend: FriendProfile) {
  if (friend.nickname?.trim()) {
    const nick = friend.nickname.trim();
    return nick.startsWith('@') ? nick : nick;
  }
  if (friend.displayName?.trim()) return friend.displayName.trim();
  if (friend.username) return `@${friend.username}`;
  return friend.email || friend.phone || '';
}

function friendSubtitle(friend: FriendProfile, label: string) {
  if (friend.username && `@${friend.username}` !== label) return `@${friend.username}`;
  if (friend.email && friend.email !== label) return friend.email;
  if (friend.phone && friend.phone !== label) return friend.phone;
  return '';
}

function smsInviteHref(text: string) {
  const body = encodeURIComponent(text);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return ios ? `sms:&body=${body}` : `sms:?body=${body}`;
}

function inviteBody(template: string, name: string) {
  return template.replace('{name}', name.trim()).replace(/\s{2,}/g, ' ').trim();
}

function inviteLine(template: string, name: string, url: string) {
  return `${inviteBody(template, name)} ${url}`.trim();
}

function messengerLinks(text: string, url: string) {
  const full = encodeURIComponent(`${text} ${url}`.trim());
  return [
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${full}` },
    {
      id: 'telegram',
      label: 'Telegram',
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
    { id: 'viber', label: 'Viber', href: `viber://forward?text=${full}` },
  ];
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement('textarea');
      el.value = value;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function FriendsView({
  currentUserId,
  onOpenRecipe,
  onCopyRecipe,
  onDiscardCopiedFromFriend,
  recipeLayout,
  onRecipeLayoutChange,
  homeRequest,
}: FriendsViewProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [query, setQuery] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendRecipeSearch, setFriendRecipeSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [friendRecipes, setFriendRecipes] = useState<FullRecipe[]>([]);
  const [friendCategory, setFriendCategory] = useState('all');
  const [friendStatus, setFriendStatus] = useState<RecipeStatusFilter>('all');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [pendingFriend, setPendingFriend] = useState<FriendProfile | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [removingFriend, setRemovingFriend] = useState<FriendProfile | null>(null);
  const [removeStep, setRemoveStep] = useState<'confirm' | 'keep'>('confirm');
  const [removing, setRemoving] = useState(false);
  const [circleFilter, setCircleFilter] = useState<FriendCircle | 'all'>('all');
  const [pendingCircle, setPendingCircle] = useState<FriendCircle>('friends');
  const [inviteTo, setInviteTo] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    setSelectedFriend(null);
  }, [homeRequest]);

  const filteredFriends = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    return friends.filter((friend) => {
      if (circleFilter !== 'all' && friend.circle !== circleFilter) return false;
      if (!q) return true;
      const haystack = [
        friendLabel(friend),
        friend.nickname,
        friend.displayName,
        friend.username,
        friend.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [friends, friendSearch, circleFilter]);

  const filteredFriendRecipes = useMemo(() => {
    return friendRecipes.filter((r) => {
      if (friendCategory !== 'all' && r.recipe.category !== friendCategory) return false;
      if (friendStatus !== 'all' && r.recipe.status !== friendStatus) return false;
      if (friendRecipeSearch.trim() && !recipeMatchesQuery(r, friendRecipeSearch)) return false;
      return true;
    });
  }, [friendRecipes, friendCategory, friendStatus, friendRecipeSearch]);

  const loadFriends = useCallback(async () => {
    const { data: rows, error: friendError } = await supabase
      .from('friendships')
      .select('friend_id, nickname, circle')
      .eq('user_id', currentUserId);
    if (friendError) throw friendError;

    const ids = (rows ?? []).map((row) => row.friend_id as string);
    if (ids.length === 0) {
      setFriends([]);
      return;
    }

    const nickById = new Map(
      (rows ?? []).map((row) => [row.friend_id as string, (row.nickname as string | null) ?? null]),
    );
    const circleById = new Map(
      (rows ?? []).map((row) => {
        const raw = String(row.circle ?? 'friends');
        return [row.friend_id as string, isFriendCircle(raw) ? raw : 'friends'] as const;
      }),
    );

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, phone, display_name, avatar_url, username')
      .in('id', ids);
    if (profileError) throw profileError;

    setFriends(
      (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        phone: p.phone,
        displayName: p.display_name,
        username: p.username,
        nickname: nickById.get(p.id) ?? null,
        avatarUrl: p.avatar_url,
        circle: circleById.get(p.id) ?? 'friends',
      })),
    );
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, username, email')
        .eq('id', currentUserId)
        .maybeSingle();
      if (cancelled || !data) return;
      const name =
        (data.display_name as string | null)?.trim() ||
        (data.username as string | null)?.trim() ||
        ((data.email as string | null)?.split('@')[0] ?? '');
      setMyName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadFriends();
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(t('authErrorGeneric'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFriends, t]);

  const saveFriendNickname = async (friendId: string, rawName: string) => {
    const nickname = rawName.trim() || null;
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ nickname })
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId);
    if (updateError) {
      setError(t('authErrorGeneric'));
      return false;
    }
    setFriends((prev) =>
      prev.map((f) => (f.id === friendId ? { ...f, nickname } : f)),
    );
    setSelectedFriend((prev) => (prev?.id === friendId ? { ...prev, nickname } : prev));
    return true;
  };

  const saveFriendCircle = async (friendId: string, circle: FriendCircle) => {
    const { error: updateError } = await supabase
      .from('friendships')
      .update({ circle })
      .eq('user_id', currentUserId)
      .eq('friend_id', friendId);
    if (updateError) {
      setError(t('authErrorGeneric'));
      return false;
    }
    setFriends((prev) => prev.map((f) => (f.id === friendId ? { ...f, circle } : f)));
    setSelectedFriend((prev) => (prev?.id === friendId ? { ...prev, circle } : prev));
    return true;
  };

  const handleAddFriend = async () => {
    const value = query.trim();
    if (!value) return;
    setAdding(true);
    setError(null);
    setMessage(null);
    setInviteTo(null);

    const { data: found, error: findError } = await supabase.rpc('find_profile', { query: value });
    if (findError) {
      setAdding(false);
      setError(t('authErrorGeneric'));
      return;
    }

    const match = Array.isArray(found) ? found[0] : found;
    if (!match?.id) {
      setAdding(false);
      setInviteTo(value);
      return;
    }

    if (match.id === currentUserId) {
      setAdding(false);
      setError(t('cannotAddSelf'));
      return;
    }

    if (friends.some((f) => f.id === match.id)) {
      setAdding(false);
      setMessage(t('alreadyFriends'));
      return;
    }

    const { error: addError } = await supabase.rpc('add_friend', { target: match.id });
    setAdding(false);
    if (addError) {
      setError(t('authErrorGeneric'));
      return;
    }

    setQuery('');
    setMessage(t('friendAdded'));
    const added: FriendProfile = {
      id: match.id,
      email: match.email ?? null,
      phone: match.phone ?? null,
      displayName: match.display_name ?? null,
      username: match.username ?? null,
      nickname: null,
      avatarUrl: match.avatar_url ?? null,
      circle: pendingCircle,
    };
    setPendingFriend(added);
    setPendingName(added.displayName || (added.username ? `@${added.username}` : ''));
    await saveFriendCircle(added.id, pendingCircle);
    await loadFriends();
  };

  const openFriend = async (friend: FriendProfile) => {
    setSelectedFriend(friend);
    setFriendCategory('all');
    setFriendStatus('all');
    setLoadingRecipes(true);
    setError(null);
    try {
      const recipes = await fetchFriendVisibleRecipes(friend.id);
      setFriendRecipes(recipes);
    } catch (err) {
      console.error(err);
      setError(t('authErrorGeneric'));
      setFriendRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const inputCls = `w-full px-4 py-3 text-base ${theme.input}`;

  const startRemoveFriend = (friend: FriendProfile) => {
    setError(null);
    setRemovingFriend(friend);
    setRemoveStep('confirm');
  };

  const finishRemoveFriend = async (keepCopies: boolean) => {
    if (!removingFriend || removing) return;
    setRemoving(true);
    setError(null);
    const friendId = removingFriend.id;
    const { error: removeError } = await supabase.rpc('remove_friend', {
      target: friendId,
      keep_copies: keepCopies,
    });
    setRemoving(false);
    if (removeError) {
      setError(t('removeFriendError'));
      return;
    }
    if (!keepCopies) onDiscardCopiedFromFriend(friendId);
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    setRemovingFriend(null);
    if (selectedFriend?.id === friendId) {
      setSelectedFriend(null);
      setFriendRecipes([]);
    }
    setMessage(t('friendRemoved'));
  };

  const removeDialog = removingFriend ? (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
      onClick={() => {
        if (!removing) setRemovingFriend(null);
      }}
    >
      <div
        className={`${theme.modalBg} w-full max-w-sm rounded-2xl p-5 border ${theme.modalBorder}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-base font-medium ${theme.textPrimary} mb-4`}>
          {removeStep === 'confirm' ? t('removeFriendConfirm') : t('removeFriendKeepCopies')}
        </p>
        {error && removeStep === 'keep' && (
          <p className="text-sm text-rose-500 mb-3">{error}</p>
        )}
        {removeStep === 'confirm' ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRemoveStep('keep')}
              className={`flex-1 py-2.5 ${theme.btnPrimary} text-base font-medium`}
            >
              {t('removeFriendYes')}
            </button>
            <button
              type="button"
              onClick={() => setRemovingFriend(null)}
              className={`flex-1 py-2.5 ${theme.btnSoft} ${theme.textPrimary} text-base font-medium`}
            >
              {t('cancel')}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={removing}
              onClick={() => void finishRemoveFriend(true)}
              className={`flex-1 py-2.5 ${theme.btnPrimary} text-base font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('removeFriendYes')}
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => void finishRemoveFriend(false)}
              className={`flex-1 py-2.5 ${theme.btnSoft} ${theme.textPrimary} text-base font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : t('removeFriendNo')}
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;

  if (selectedFriend) {
    const name = friendLabel(selectedFriend) || t('friends');
    return (
    <>
      <div className="px-4">
        <button
          onClick={() => {
            setSelectedFriend(null);
            setFriendRecipes([]);
            setFriendCategory('all');
            setFriendStatus('all');
          }}
          className={`flex items-center gap-2 mb-4 ${theme.textSecondary} hover:${theme.textPrimary}`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-base font-medium">{t('friends')}</span>
        </button>
        <div className="flex items-center gap-3 mb-1">
          <AvatarBox
            url={selectedFriend.avatarUrl}
            label={name}
            gradient={theme.headerLogoGradient}
          />
          <div className="min-w-0 flex-1">
            <h2 className={`text-xl font-bold ${theme.textPrimary} truncate`}>{name}</h2>
            {friendSubtitle(selectedFriend, name) && (
              <p className={`text-sm ${theme.textSecondary} truncate`}>
                {friendSubtitle(selectedFriend, name)}
              </p>
            )}
            <p className={`text-sm ${theme.textAccent}`}>{t(circleLabelKey(selectedFriend.circle))}</p>
          </div>
          <button
            type="button"
            onClick={() => startRemoveFriend(selectedFriend)}
            title={t('removeFriend')}
            className={`p-3 rounded-xl text-rose-500 hover:bg-rose-50`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
        <p className={`text-base ${theme.textSecondary} mb-4`}>{t('friendRecipes')}</p>
        {message && <p className="text-sm text-green-600 mb-3">{message}</p>}
        {loadingRecipes ? (
          <div className="flex justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${theme.textAccent}`} />
          </div>
        ) : (
          <>
            <div className="-mx-4">
              <RecipeFilterBar
                selectedCategory={friendCategory}
                onSelectCategory={setFriendCategory}
                statusFilter={friendStatus}
                onSelectStatus={setFriendStatus}
                searchQuery={friendRecipeSearch}
                onSearchChange={setFriendRecipeSearch}
                layout={recipeLayout}
                onLayoutChange={onRecipeLayoutChange}
              />
            </div>
            {filteredFriendRecipes.length > 0 ? (
              <div
                className={`grid sm:grid-cols-2 lg:grid-cols-3 ${
                  recipeLayout === 'grid'
                    ? 'grid-cols-2 gap-2 sm:gap-4'
                    : 'grid-cols-1 gap-4'
                }`}
              >
                {filteredFriendRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.recipe.id}
                    compact={recipeLayout === 'grid'}
                    recipe={recipe}
                    isOwner={false}
                    onView={() => onOpenRecipe(recipe)}
                    onEdit={() => undefined}
                    onDelete={() => undefined}
                    onToggleStatus={() => undefined}
                    onCopy={() => {
                      const result = onCopyRecipe(recipe);
                      if (result === 'duplicate') setMessage(t('recipeAlreadyExists'));
                      else if (result) setMessage(t('savedToMyBook'));
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className={`${theme.textSecondary} text-center py-12`}>{t('noRecipes')}</p>
            )}
          </>
        )}
      </div>
      {removeDialog}
    </>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-4">
      <div className={`${theme.card} p-4`}>
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className={`w-5 h-5 ${theme.textAccent}`} />
          <h3 className={`font-bold ${theme.textPrimary}`}>{t('addFriend')}</h3>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddFriend();
            }}
            placeholder={t('friendPhoneOrEmail')}
            className={inputCls}
          />
          <button
            onClick={handleAddFriend}
            disabled={adding || !query.trim()}
            className={`shrink-0 px-4 py-3 ${theme.btnPrimary} font-medium disabled:opacity-50`}
          >
            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : t('add')}
          </button>
        </div>
        <div className="mt-3">
          <p className={`text-sm mb-2 ${theme.textSecondary}`}>{t('friendCircle')}</p>
          <CircleChips value={pendingCircle} onChange={setPendingCircle} />
        </div>
        {error && <p className="text-sm text-rose-500 mt-2">{error}</p>}
        {message && <p className="text-sm text-green-600 mt-2">{message}</p>}
        {inviteTo && (
          <div className={`mt-3 rounded-xl border p-3 ${theme.border}`}>
            <p className={`text-sm font-medium ${theme.textPrimary}`}>{t('inviteFriend')}</p>
            <p className={`text-sm mt-1 ${theme.textSecondary}`}>{t('inviteFriendHint')}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <a
                href={smsInviteHref(inviteLine(t('inviteMessage'), myName, window.location.origin))}
                className={`inline-flex items-center gap-1.5 px-3 py-2 ${theme.btnSoft} ${theme.textPrimary} text-sm font-medium`}
              >
                <MessageSquare className="w-4 h-4" />
                {t('inviteBySms')}
              </a>
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setShareOpen((open) => !open);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 ${theme.btnPrimary} text-sm font-medium`}
              >
                <Share2 className="w-4 h-4" />
                {t('inviteShare')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(window.location.origin);
                  if (ok) {
                    setError(null);
                    setMessage(t('copied'));
                  } else {
                    setError(t('authErrorGeneric'));
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 ${theme.btnSoft} ${theme.textPrimary} text-sm font-medium`}
              >
                <Copy className="w-4 h-4" />
                {t('inviteCopyLink')}
              </button>
            </div>
            {shareOpen && (
              <div className="flex flex-wrap gap-2 mt-2">
                {messengerLinks(inviteBody(t('inviteMessage'), myName), window.location.origin).map(
                  (item) => (
                    <a
                      key={item.id}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center px-3 py-2 ${theme.chip} text-sm font-medium`}
                    >
                      {item.label}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {pendingFriend && (
        <div className={`${theme.card} p-4`}>
          <p className={`text-base font-medium ${theme.textPrimary} mb-2`}>{t('friendName')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              placeholder={t('friendNamePlaceholder')}
              className={inputCls}
            />
            <button
              onClick={async () => {
                const ok = await saveFriendNickname(pendingFriend.id, pendingName);
                if (ok) {
                  setPendingFriend(null);
                  setPendingName('');
                }
              }}
              className={`shrink-0 px-4 py-3 ${theme.btnPrimary} font-medium`}
            >
              {t('saveFriendName')}
            </button>
          </div>
          <div className="mt-3">
            <p className={`text-sm mb-2 ${theme.textSecondary}`}>{t('friendCircle')}</p>
            <CircleChips
              value={pendingCircle}
              onChange={(circle) => {
                setPendingCircle(circle);
                void saveFriendCircle(pendingFriend.id, circle);
              }}
            />
          </div>
          <button
            onClick={() => {
              setPendingFriend(null);
              setPendingName('');
            }}
            className={`mt-2 text-sm ${theme.textSecondary}`}
          >
            {t('skipForNow')}
          </button>
        </div>
      )}

      {friends.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCircleFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium ${
                circleFilter === 'all' ? theme.chipActive : theme.chip
              }`}
            >
              {t('allCircles')}
            </button>
            {FRIEND_CIRCLES.map((circle) => (
              <button
                key={circle}
                type="button"
                onClick={() => setCircleFilter(circle)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  circleFilter === circle ? theme.chipActive : theme.chip
                }`}
              >
                {t(circleLabelKey(circle))}
              </button>
            ))}
          </div>
          <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            placeholder={t('searchFriendsPlaceholder')}
            className={`w-full pl-12 pr-4 py-3 text-base ${theme.input}`}
          />
        </div>
        </>
      )}

      <div className={`${theme.card} overflow-hidden`}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className={`w-8 h-8 animate-spin ${theme.textAccent}`} />
          </div>
        ) : friends.length === 0 ? (
          <div className={`p-8 text-center ${theme.textSecondary}`}>
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t('noFriendsYet')}</p>
          </div>
        ) : filteredFriends.length === 0 ? (
          <div className={`p-8 text-center ${theme.textSecondary}`}>
            <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>{t('noFriendsMatch')}</p>
          </div>
        ) : (
          <ul>
            {filteredFriends.map((friend) => {
              const name = friendLabel(friend);
              const subtitle = friendSubtitle(friend, name);
              const isEditing = editingFriendId === friend.id;
              return (
                <li key={friend.id} className={`border-t first:border-t-0 ${theme.border}`}>
                  {isEditing ? (
                    <div className="p-4 space-y-3">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        placeholder={t('friendNamePlaceholder')}
                        className={inputCls}
                      />
                      <div>
                        <p className={`text-sm mb-2 ${theme.textSecondary}`}>{t('friendCircle')}</p>
                        <CircleChips
                          value={friend.circle}
                          onChange={(circle) => void saveFriendCircle(friend.id, circle)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const ok = await saveFriendNickname(friend.id, editingName);
                            if (ok) setEditingFriendId(null);
                          }}
                          className={`px-4 py-2 ${theme.btnPrimary} text-base font-medium`}
                        >
                          {t('save')}
                        </button>
                        <button
                          onClick={() => setEditingFriendId(null)}
                          className={`px-4 py-2 text-base ${theme.textSecondary}`}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <button
                        onClick={() => openFriend(friend)}
                        className="flex-1 flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors min-w-0"
                      >
                        <AvatarBox
                          url={friend.avatarUrl}
                          label={name}
                          gradient={theme.headerLogoGradient}
                        />
                        <div className="min-w-0">
                          <p className={`font-semibold ${theme.textPrimary} truncate`}>{name}</p>
                          {subtitle && (
                            <p className={`text-base ${theme.textSecondary} truncate`}>{subtitle}</p>
                          )}
                          <p className={`text-sm ${theme.textAccent}`}>{t(circleLabelKey(friend.circle))}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setEditingFriendId(friend.id);
                          setEditingName(friend.nickname || friend.displayName || (friend.username ? `@${friend.username}` : ''));
                        }}
                        title={t('editFriendName')}
                        className={`p-3 rounded-xl ${theme.textSecondary} hover:bg-gray-50`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startRemoveFriend(friend)}
                        title={t('removeFriend')}
                        className="p-3 mr-2 rounded-xl text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {removeDialog}
    </div>
  );
}
