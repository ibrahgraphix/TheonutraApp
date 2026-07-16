import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Avatar, Badge, ShopHeader, TeamMemberRow } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
    getCurrencyForCountry,
    getDistributorById,
    getTeamForDistributor,
} from '../../services/api';
import type { Distributor, TeamMember } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'DistributorDetail'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'DistributorDetail'>;

/**
 * Recursive expand/collapse tree — same pattern as TeamListScreen's local
 * TeamTree, reused here so staff get one continuous screen (profile + full
 * chain) instead of drilling into a new screen per level.
 */
function DownlineTree({
    members,
    currency,
    expandedIds,
    onToggle,
    depth = 0,
}: {
    members: TeamMember[];
    currency: string;
    expandedIds: Set<string>;
    onToggle: (id: string) => void;
    depth?: number;
}) {
    return (
        <>
            {members.map((member) => {
                const id = member.distributor.id;
                const expanded = expandedIds.has(id);
                return (
                    <View key={id}>
                        <TeamMemberRow
                            currency={currency}
                            depth={depth}
                            expanded={expanded}
                            member={member}
                            onPress={() => onToggle(id)}
                            onToggle={() => onToggle(id)}
                        />
                        {expanded && member.children.length > 0 ? (
                            <DownlineTree
                                currency={currency}
                                depth={depth + 1}
                                expandedIds={expandedIds}
                                members={member.children}
                                onToggle={onToggle}
                            />
                        ) : null}
                    </View>
                );
            })}
        </>
    );
}

export function DistributorDetailScreen() {
    const navigation = useNavigation<NavigationProp>();
    const route = useRoute<ScreenRoute>();
    const { distributorId } = route.params;

    const [profile, setProfile] = useState<Distributor | null>(null);
    const [downline, setDownline] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const currency = profile ? getCurrencyForCountry(profile.country) : 'USD';

    const load = useCallback(async () => {
        const [dist, team] = await Promise.all([
            getDistributorById(distributorId),
            getTeamForDistributor(distributorId),
        ]);
        setProfile(dist);
        setDownline(team);
    }, [distributorId]);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const directCount = downline.length;
    const totalCount = countAll(downline);

    return (
        <View style={styles.container}>
            <ShopHeader onBack={() => navigation.goBack()} title="Distributor" />

            {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.loader} />
            ) : !profile ? (
                <Text style={styles.error}>Distributor not found.</Text>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.content}
                    refreshControl={
                        <RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />
                    }
                >
                    <View style={styles.profile}>
                        <Avatar name={profile.fullName} size={64} />
                        <Text style={styles.name}>{profile.fullName}</Text>
                        <Badge label={profile.distributorId} variant="secondary" />
                        <Text style={styles.meta}>
                            {profile.country} · Joined {formatDate(profile.joinDate)}
                        </Text>
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Downline Chain</Text>
                        <Text style={styles.sectionSubtitle}>
                            {directCount} direct recruit{directCount !== 1 ? 's' : ''} · {totalCount} total in
                            chain · Tap a member to expand
                        </Text>
                    </View>

                    {downline.length === 0 ? (
                        <Text style={styles.empty}>No recruits yet.</Text>
                    ) : (
                        <DownlineTree
                            currency={currency}
                            expandedIds={expandedIds}
                            members={downline}
                            onToggle={toggleExpand}
                        />
                    )}
                </ScrollView>
            )}
        </View>
    );
}

function countAll(members: TeamMember[]): number {
    let total = 0;
    for (const m of members) {
        total += 1 + countAll(m.children);
    }
    return total;
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.background,
        flex: 1,
    },
    loader: {
        marginTop: spacing.xxxl,
    },
    error: {
        ...typography.body,
        color: colors.error,
        padding: spacing.xxl,
        textAlign: 'center',
    },
    content: {
        gap: spacing.lg,
        padding: spacing.lg,
        paddingBottom: spacing.xxxl,
    },
    profile: {
        alignItems: 'center',
        gap: spacing.sm,
    },
    name: {
        ...typography.h2,
        color: colors.text,
    },
    meta: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    sectionHeader: {
        gap: spacing.xs,
    },
    sectionTitle: {
        ...typography.h3,
        color: colors.text,
    },
    sectionSubtitle: {
        ...typography.bodySmall,
        color: colors.textSecondary,
    },
    empty: {
        ...typography.body,
        color: colors.textSecondary,
    },
});