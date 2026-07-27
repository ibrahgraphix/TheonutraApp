import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Avatar, Badge, ConfirmModal, ShopHeader, TeamMemberRow } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import {
    activateSeller,
    deactivateSeller,
    getCurrencyForCountry,
    getDistributorById,
    getTeamForDistributor,
    hardDeleteSeller,
} from '../../services/api';
import type { Distributor, TeamMember } from '../../types';
import { formatDate } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'DistributorDetail'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'DistributorDetail'>;
type ConfirmAction = 'activate' | 'deactivate' | 'delete' | null;

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
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [processing, setProcessing] = useState(false);

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

    const handleConfirm = async () => {
        if (!confirmAction) return;
        setProcessing(true);
        try {
            if (confirmAction === 'activate') {
                await activateSeller(distributorId);
                setConfirmAction(null);
                await load();
            } else if (confirmAction === 'deactivate') {
                await deactivateSeller(distributorId);
                setConfirmAction(null);
                await load();
            } else {
                await hardDeleteSeller(distributorId);
                setConfirmAction(null);
                navigation.goBack();
            }
        } catch (err) {
            Alert.alert(
                confirmAction === 'delete' ? 'Cannot delete' : 'Action failed',
                err instanceof Error ? err.message : 'Action failed.',
            );
        } finally {
            setProcessing(false);
        }
    };

    const confirmCopy = (() => {
        if (confirmAction === 'activate') {
            return {
                title: 'Activate Distributor?',
                message: `Reactivate ${profile?.fullName ?? 'this distributor'}? They will be able to log in again.`,
                confirmLabel: 'Activate',
            };
        }
        if (confirmAction === 'deactivate') {
            return {
                title: 'Deactivate Distributor?',
                message: `Deactivate ${profile?.fullName ?? 'this distributor'}? They'll be blocked from logging in, but history stays intact.`,
                confirmLabel: 'Deactivate',
            };
        }
        return {
            title: 'Delete Distributor?',
            message: `Permanently delete ${profile?.fullName ?? 'this distributor'}? Only works if they have no downline, orders, or commissions.`,
            confirmLabel: 'Delete Forever',
        };
    })();

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
                        {profile.isActive === false ? <Badge label="Inactive" variant="error" /> : null}
                        <Text style={styles.meta}>
                            {profile.country} · Joined {formatDate(profile.joinDate)}
                        </Text>
                    </View>

                    <View style={styles.actionsRow}>
                        <Pressable
                            onPress={() => navigation.navigate('EditSeller', { distributorId })}
                            style={styles.actionBtn}
                        >
                            <Text style={styles.actionText}>Edit</Text>
                        </Pressable>
                        <Pressable
                            onPress={() =>
                                navigation.navigate('ResetPassword', {
                                    distributorId,
                                    distributorName: profile.fullName,
                                })
                            }
                            style={styles.actionBtn}
                        >
                            <Text style={styles.actionText}>Reset Password</Text>
                        </Pressable>
                        {profile.isActive === false ? (
                            <Pressable
                                onPress={() => setConfirmAction('activate')}
                                style={styles.actionBtn}
                            >
                                <Text style={styles.activateText}>Activate</Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => setConfirmAction('deactivate')}
                                style={styles.actionBtn}
                            >
                                <Text style={styles.deactivateText}>Deactivate</Text>
                            </Pressable>
                        )}
                        <Pressable
                            onPress={() => setConfirmAction('delete')}
                            style={styles.actionBtn}
                        >
                            <Text style={styles.deleteText}>Delete</Text>
                        </Pressable>
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

            <ConfirmModal
                confirmLabel={confirmCopy.confirmLabel}
                destructive={confirmAction !== 'activate'}
                loading={processing}
                message={confirmCopy.message}
                onCancel={() => setConfirmAction(null)}
                onConfirm={handleConfirm}
                title={confirmCopy.title}
                visible={confirmAction !== null}
            />
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
    actionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        justifyContent: 'center',
    },
    actionBtn: {
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
    },
    actionText: {
        ...typography.bodySmall,
        color: colors.primary,
        fontWeight: '600',
    },
    deactivateText: {
        ...typography.bodySmall,
        color: colors.error,
        fontWeight: '600',
    },
    activateText: {
        ...typography.bodySmall,
        color: colors.success,
        fontWeight: '600',
    },
    deleteText: {
        ...typography.bodySmall,
        color: colors.error,
        fontWeight: '600',
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