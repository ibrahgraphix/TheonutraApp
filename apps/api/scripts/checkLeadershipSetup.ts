// scripts/checkLeadershipSetup.ts — verify leadership ranks setup
import '../src/config/env.js';
import { supabase } from '../src/config/supabase.js';

async function run() {
  console.log('🔍 Checking Leadership Ranks Setup...\n');

  try {
    // Check leadership_ranks table
    const { data: leadershipRanks, error: ranksError } = await supabase
      .from('leadership_ranks')
      .select('*')
      .order('level_order', { ascending: true });

    if (ranksError) {
      console.error('❌ Error fetching leadership ranks:', ranksError.message);
    } else {
      console.log('✅ Leadership Ranks:');
      console.log(JSON.stringify(leadershipRanks, null, 2));
    }

    // Check leadership_bonuses table
    const { data: leadershipBonuses, error: bonusesError } = await supabase
      .from('leadership_bonuses')
      .select('*')
      .limit(1);

    if (bonusesError) {
      console.error('❌ Leadership bonuses table error:', bonusesError.message);
    } else {
      console.log('\n✅ Leadership Bonuses table exists:', leadershipBonuses !== null);
    }

    // Check distributor_yearly_gpv table
    const { data: yearlyGpv, error: gpvError } = await supabase
      .from('distributor_yearly_gpv')
      .select('*')
      .limit(1);

    if (gpvError) {
      console.error('❌ Yearly GPV table error:', gpvError.message);
    } else {
      console.log('✅ Yearly GPV table exists:', yearlyGpv !== null);
    }

    // Check profiles for leadership_rank_id
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('distributor_id, leadership_rank_id')
      .limit(3);

    if (profilesError) {
      console.error('❌ Profiles error:', profilesError.message);
    } else {
      console.log('\n✅ Sample profiles with leadership_rank_id:');
      console.log(JSON.stringify(profiles, null, 2));
    }

    console.log('\n🎉 Leadership setup check completed!');
  } catch (error) {
    console.error('❌ Setup check failed:', error);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
