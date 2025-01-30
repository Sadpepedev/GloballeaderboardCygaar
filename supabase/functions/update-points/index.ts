import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'
import { ethers } from 'https://esm.sh/ethers@6.11.1'

const CYGAAR_ADDRESS = '0x35EfA4699EdD7b468CBBf4FfF7B6e7AFC0A7aDa6'
const START_BLOCK = 257810n
const POINTS_PER_TOKEN = 0.0000000001

// ABI for the balanceOf function
const ABI = [{
  constant: true,
  inputs: [{ name: '_owner', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: 'balance', type: 'uint256' }],
  type: 'function'
}]

Deno.serve(async (req) => {
  try {
    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const abstractRpcUrl = Deno.env.get('ABSTRACT_RPC_URL')!

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize ethers provider and contract
    const provider = new ethers.JsonRpcProvider(abstractRpcUrl)
    const contract = new ethers.Contract(CYGAAR_ADDRESS, ABI, provider)

    // Get current block number
    const currentBlock = await provider.getBlockNumber()

    // Fetch all addresses from the leaderboard
    const { data: leaderboard, error: fetchError } = await supabase
      .from('points_leaderboard')
      .select('address')

    if (fetchError) {
      throw new Error(`Error fetching leaderboard: ${fetchError.message}`)
    }

    // Update points for each address
    for (const entry of leaderboard || []) {
      try {
        // Get token balance
        const balance = await contract.balanceOf(entry.address)
        const tokenBalance = Number(ethers.formatEther(balance))

        // Calculate points
        const blocksHeld = tokenBalance > 0 ? Number(currentBlock - START_BLOCK) : 0
        const points = tokenBalance * POINTS_PER_TOKEN * blocksHeld

        // Update the leaderboard
        const { error: updateError } = await supabase
          .from('points_leaderboard')
          .update({
            points: points,
            last_updated: new Date().toISOString()
          })
          .eq('address', entry.address)

        if (updateError) {
          console.error(`Error updating points for ${entry.address}: ${updateError.message}`)
        }
      } catch (error) {
        console.error(`Error processing address ${entry.address}: ${error}`)
        continue // Continue with next address even if one fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Points updated successfully' }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})