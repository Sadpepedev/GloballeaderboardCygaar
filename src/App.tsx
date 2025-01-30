import React, { useState, useEffect } from 'react';
import { createPublicClient, http, formatEther } from 'viem';
import { abstract } from 'viem/chains';
import { Coins, Trophy, Clock, Search, Crown, Sparkles, ExternalLink, Skull } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { ParticleBackground } from './components/ParticleBackground';

const CYGAAR_ADDRESS = '0x35EfA4699EdD7b468CBBf4FfF7B6e7AFC0A7aDa6';
const UNISWAP_POOL = '0xBe01179F2291773D220Eae55Ee85b417F40342d0';
const START_BLOCK = 257810n;
const POINTS_PER_TOKEN = 0.0000000001;
const LINKTREE_URL = 'https://linktr.ee/CygaarGroupie';
const CYGAAR_IMAGE = 'https://github.com/Sadpepedev/Cygaarverse-live/blob/main/0682a8ef-dd5b-4eff-a538-028436b3e3a5_rEKKc4YC-400x400.png?raw=true';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const publicClient = createPublicClient({
  chain: abstract,
  transport: http()
});

interface PointsData {
  balance: string;
  points: number;
  blocksHeld: number;
  level: number;
}

interface LeaderboardEntry {
  address: string;
  points: number;
  last_updated: string;
  display_name?: string;
}

interface WalletProfile {
  display_name: string;
}

function calculateLevel(points: number): number {
  if (points <= 35) return 1;
  if (points <= 350) return 2;
  if (points <= 3500) return 3;
  return 4;
}

function getLevelEmoji(level: number): string {
  switch (level) {
    case 1: return '🌱';
    case 2: return '🌿';
    case 3: return '🌳';
    case 4: return '🌟';
    default: return '🌱';
  }
}

function App() {
  const { address: connectedAddress } = useAccount();
  const [address, setAddress] = useState('');
  const [pointsData, setPointsData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);

  useEffect(() => {
    if (connectedAddress) {
      setAddress(connectedAddress);
      calculatePoints(connectedAddress);
      checkExistingProfile(connectedAddress);
    } else {
      // Clear points data when wallet is disconnected
      setPointsData(null);
      setAddress('');
      setShowPointsAnimation(false);
      setShowLevelUp(false);
      setError('');
    }
  }, [connectedAddress]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkExistingProfile = async (walletAddress: string) => {
    if (hasCheckedProfile) return;

    try {
      const { data, error } = await supabase
        .from('wallet_profiles')
        .select('display_name')
        .eq('address', walletAddress.toLowerCase());

      if (!error && (!data || data.length === 0)) {
        setShowProfileModal(true);
      }
      setHasCheckedProfile(true);
    } catch (error) {
      console.error('Error checking profile:', error);
      setHasCheckedProfile(true);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('points_leaderboard')
        .select(`
          address,
          points,
          last_updated,
          wallet_profiles (
            display_name
          )
        `)
        .neq('address', UNISWAP_POOL)
        .order('points', { ascending: false })
        .limit(25);

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else {
        const formattedData = data.map(entry => ({
          ...entry,
          display_name: entry.wallet_profiles?.display_name
        }));
        setLeaderboard(formattedData);
      }
    } catch (error) {
      console.error('Error in fetchLeaderboard:', error);
    }
  };

  const saveProfile = async () => {
    if (!connectedAddress || !displayName.trim()) return;

    try {
      const { error } = await supabase
        .from('wallet_profiles')
        .upsert({
          address: connectedAddress.toLowerCase(),
          display_name: displayName.trim()
        });

      if (error) throw error;
      
      setShowProfileModal(false);
      fetchLeaderboard();
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const calculatePoints = async (addressToCheck = address) => {
    if (!addressToCheck) {
      setError('Please enter an address');
      return;
    }

    if (addressToCheck.toLowerCase() === UNISWAP_POOL.toLowerCase()) {
      setError('This address is not eligible for points tracking');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setShowPointsAnimation(false);
      setShowLevelUp(false);

      const currentBlock = await publicClient.getBlockNumber();
      const balance = await publicClient.readContract({
        address: CYGAAR_ADDRESS,
        abi: [{
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }],
        functionName: 'balanceOf',
        args: [addressToCheck]
      });

      const tokenBalance = Number(formatEther(balance as bigint));
      
      const blocksHeld = tokenBalance > 0 ? Number(currentBlock - START_BLOCK) : 0;
      const points = tokenBalance * POINTS_PER_TOKEN * blocksHeld;
      const level = calculateLevel(points);

      const pointsData = {
        balance: tokenBalance.toFixed(2),
        points: points,
        blocksHeld,
        level
      };

      setPointsData(pointsData);
      setShowPointsAnimation(true);
      setShowLevelUp(true);

      if (points > 0) {
        const { error: upsertError } = await supabase
          .from('points_leaderboard')
          .upsert({
            address: addressToCheck.toLowerCase(),
            points: points,
            last_updated: new Date().toISOString()
          });

        if (upsertError) {
          console.error('Error updating leaderboard:', upsertError);
        } else {
          fetchLeaderboard();
        }
      }

    } catch (err) {
      setError('Error fetching data. Please check the address and try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      calculatePoints();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 text-white relative overflow-hidden">
      <ParticleBackground />
      
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <a
            href={LINKTREE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-2 px-4 py-2 bg-blue-500/90 hover:bg-blue-600 rounded-lg font-semibold transition-all duration-300 backdrop-blur-sm hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/20 w-full sm:w-auto justify-center sm:justify-start"
          >
            <span>Explore Cygaarverse</span>
            <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </a>
          <div className="w-full sm:w-auto">
            <ConnectButton />
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12 py-4">
            <h1 className="text-4xl md:text-6xl font-bold mb-3 md:mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 animate-pulse leading-normal md:leading-normal">
              Welcome to the Cygaarverse
            </h1>
            <h2 className="text-xl md:text-2xl text-gray-300 group relative inline-block cursor-pointer">
              Cygaar is always watching
              <div className="absolute -bottom-2 right-0 transform translate-y-full opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none">
                <img 
                  src={CYGAAR_IMAGE} 
                  alt="Cygaar watching"
                  className="w-24 h-24 rounded-full border-2 border-blue-500 shadow-lg transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"
                />
              </div>
            </h2>
          </div>

          <div className="bg-black/30 backdrop-blur-lg rounded-xl md:rounded-2xl p-4 md:p-8 shadow-2xl border border-purple-500/20 transition-all duration-300 hover:border-purple-500/40">
            {!connectedAddress && (
              <div className="mb-6 text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-blue-200">
                  💡 Connect your wallet to add a custom name to the leaderboard!
                </p>
              </div>
            )}

            <div className="mb-6 md:mb-8">
              <div className="flex flex-col md:flex-row gap-3 md:gap-4">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter wallet address"
                  className="w-full px-4 py-3 bg-purple-900/20 rounded-lg border border-purple-500/20 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 transition-all duration-300 text-sm md:text-base"
                />
                <button
                  onClick={() => calculatePoints()}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 hover:scale-105 active:scale-95 text-sm md:text-base whitespace-nowrap shadow-lg hover:shadow-blue-500/20"
                >
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                  Calculate
                </button>
              </div>
              {error && (
                <p className="text-red-400 mt-2 animate-fade-in text-sm md:text-base">
                  <span className="inline-block align-middle mr-2">⚠️</span>
                  {error}
                </p>
              )}
            </div>

            {loading && (
              <div className="text-center py-6 md:py-8">
                <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="mt-4 text-gray-300 text-sm md:text-base">Calculating points...</p>
              </div>
            )}

            {pointsData && (
              <>
                <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 ${showPointsAnimation ? 'animate-fade-in' : ''}`}>
                  <div className="bg-purple-900/30 p-4 md:p-6 rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Coins className="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                      <h3 className="text-base md:text-lg font-semibold">Token Balance</h3>
                    </div>
                    <p className="text-xl md:text-2xl font-bold">{pointsData.balance}</p>
                  </div>

                  <div className="bg-blue-900/30 p-4 md:p-6 rounded-xl border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Trophy className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                      <h3 className="text-base md:text-lg font-semibold">Total Points</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xl md:text-2xl font-bold break-all">{pointsData.points.toFixed(2)}</p>
                      {showPointsAnimation && pointsData.points > 0 && (
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-yellow-400 animate-bounce flex-shrink-0" />
                      )}
                    </div>
                  </div>

                  <div className="bg-indigo-900/30 p-4 md:p-6 rounded-xl border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-300 hover:transform hover:scale-105">
                    <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-indigo-400" />
                      <h3 className="text-base md:text-lg font-semibold">Blocks Held</h3>
                    </div>
                    <p className="text-xl md:text-2xl font-bold">{pointsData.blocksHeld.toLocaleString()}</p>
                  </div>
                </div>

                {pointsData.points === 0 && pointsData.blocksHeld === 0 && (
                  <div className="mt-6 text-center bg-red-500/10 p-4 rounded-lg animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-2xl font-bold text-red-400">Womp Womp</h3>
                      <Skull className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-red-200 mt-2">No points or blocks held yet. Time to join the Cygaarverse!</p>
                  </div>
                )}

                {showLevelUp && pointsData.points > 0 && (
                  <div className="mt-6 text-center bg-gradient-to-r from-yellow-500/20 via-yellow-400/20 to-yellow-500/20 p-4 rounded-lg animate-fade-in">
                    <h3 className="text-2xl font-bold text-yellow-400 mb-2">
                      {getLevelEmoji(pointsData.level)} Level {pointsData.level} {getLevelEmoji(pointsData.level)}
                    </h3>
                    <p className="text-yellow-200">
                      {pointsData.level === 4 ? "Maximum level achieved! You're a true legend!" : `Keep holding to reach the next level!`}
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="mt-8 md:mt-12">
              <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6 justify-center">
                <Crown className="w-5 h-5 md:w-6 md:h-6 text-yellow-400" />
                <h2 className="text-xl md:text-2xl font-bold">Leaderboard</h2>
              </div>
              <div className="bg-black/20 rounded-xl border border-yellow-500/20 overflow-x-auto hover:border-yellow-500/40 transition-all duration-300">
                <table className="w-full">
                  <thead>
                    <tr className="bg-yellow-500/10">
                      <th className="px-4 md:px-6 py-3 md:py-4 text-left text-sm md:text-base">Rank</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-left text-sm md:text-base">Address</th>
                      <th className="px-4 md:px-6 py-3 md:py-4 text-right text-sm md:text-base">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, index) => (
                      <tr 
                        key={entry.address} 
                        className="border-t border-yellow-500/10 hover:bg-yellow-500/5 transition-colors duration-200"
                      >
                        <td className="px-4 md:px-6 py-3 md:py-4 text-sm md:text-base">
                          {index === 0 ? '👑' : `#${index + 1}`}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 font-mono text-sm md:text-base">
                          {entry.display_name || shortenAddress(entry.address)}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 text-right font-bold text-sm md:text-base">
                          {entry.points.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-8 text-center text-gray-400 text-xs md:text-sm">
            <p>Points are calculated at a rate of {POINTS_PER_TOKEN} points per token per block</p>
            <p>Starting from block {START_BLOCK.toString()}</p>
          </div>
        </div>
      </div>

      {showProfileModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Set Your Display Name</h3>
            <p className="text-gray-300 mb-4">Choose a name to display on the leaderboard instead of your wallet address.</p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 mb-4"
            />
            <div className="flex gap-4">
              <button
                onClick={saveProfile}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-blue-500/20"
              >
                Save
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-gray-500/20"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;