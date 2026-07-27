import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { z } from 'zod';

import { Button, Input, ShopHeader } from '../../components';
import type { ManageStackParamList } from '../../navigation/manageTypes';
import { createEvent, listPastEvents, listUpcomingEvents, updateEvent } from '../../services/api';
import type { EventType } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

type NavigationProp = NativeStackNavigationProp<ManageStackParamList, 'AddEditEvent'>;
type ScreenRoute = RouteProp<ManageStackParamList, 'AddEditEvent'>;

const EVENT_TYPES: Array<[EventType, string]> = [
  ['general', '📅 General'],
  ['health_education', '🩺 Health Education'],
  ['training', '🎓 Training'],
  ['product_launch', '🚀 Product Launch'],
];

const schema = z.object({
  title: z.string().min(3, 'Title required'),
  description: z.string().optional(),
  location: z.string().optional(),
  meetingNote: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddEditEventScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRoute>();
  const eventId = route.params.eventId;
  const isEdit = Boolean(eventId);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [eventType, setEventType] = useState<EventType>('general');
  const [isOnline, setIsOnline] = useState(false);
  const [startAt, setStartAt] = useState(new Date());
  const [endAt, setEndAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  // iOS only — Android uses the imperative DateTimePickerAndroid.open() API
  // instead of rendering a component, so these flags stay unused on Android.
  const [showStartPickerIOS, setShowStartPickerIOS] = useState(false);
  const [showEndPickerIOS, setShowEndPickerIOS] = useState(false);

  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', location: '', meetingNote: '' },
  });

  useEffect(() => {
    if (!isEdit || !eventId) return;
    Promise.all([listUpcomingEvents(), listPastEvents()]).then(([upcoming, past]) => {
      const found = [...upcoming, ...past].find((e) => e.id === eventId);
      if (found) {
        reset({
          title: found.title,
          description: found.description ?? '',
          location: found.location ?? '',
          meetingNote: found.meeting_note ?? '',
        });
        setEventType(found.event_type);
        setIsOnline(found.is_online);
        setStartAt(new Date(found.start_at));
        setEndAt(new Date(found.end_at));
      }
      setLoading(false);
    });
  }, [isEdit, eventId, reset]);

  // Opens the date, then time, picker for a given target using the platform's
  // correct API. On Android, DateTimePickerAndroid.open() must be called
  // imperatively — rendering <DateTimePicker> declaratively (the iOS way)
  // crashes with "Cannot read property 'dismiss' of undefined".
  const pickDateTime = (current: Date, onPicked: (date: Date) => void) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        onChange: (event, selectedDate) => {
          if (event.type !== 'set' || !selectedDate) return;
          // Chain into a time picker after the date is picked, preserving
          // the picked date's Y/M/D and letting the user set H/M next.
          DateTimePickerAndroid.open({
            value: current,
            mode: 'time',
            onChange: (timeEvent, selectedTime) => {
              if (timeEvent.type !== 'set' || !selectedTime) return;
              const combined = new Date(selectedDate);
              combined.setHours(selectedTime.getHours(), selectedTime.getMinutes());
              onPicked(combined);
            },
          });
        },
      });
    }
    // iOS: handled by the declarative <DateTimePicker> rendered below —
    // this function only needs to flip the visibility flag there.
  };

  const openStartPicker = () => {
    if (Platform.OS === 'android') {
      pickDateTime(startAt, setStartAt);
    } else {
      setShowStartPickerIOS(true);
    }
  };

  const openEndPicker = () => {
    if (Platform.OS === 'android') {
      pickDateTime(endAt, setEndAt);
    } else {
      setShowEndPickerIOS(true);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    if (endAt <= startAt) {
      Alert.alert('Invalid dates', 'End time must be after start time.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
        event_type: eventType,
        location: data.location?.trim() || undefined,
        is_online: isOnline,
        meeting_note: data.meetingNote?.trim() || undefined,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
      };

      if (isEdit && eventId) {
        await updateEvent(eventId, payload);
        Alert.alert('Saved', 'Event updated.');
      } else {
        await createEvent(payload);
        Alert.alert('Saved', 'Event created.');
      }
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setSaving(false);
    }
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ShopHeader onBack={() => navigation.goBack()} title={isEdit ? 'Edit Event' : 'Add Event'} />
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopHeader onBack={() => navigation.goBack()} title={isEdit ? 'Edit Event' : 'Add Event'} />

      <ScrollView contentContainerStyle={styles.content}>
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <Input error={error?.message} label="Title" onChangeText={onChange} value={value} />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, value } }) => (
            <Input
              label="Description"
              multiline
              numberOfLines={4}
              onChangeText={onChange}
              style={styles.textArea}
              value={value}
            />
          )}
        />

        <Text style={styles.sectionTitle}>Event Type</Text>
        <View style={styles.typeRow}>
          {EVENT_TYPES.map(([val, label]) => (
            <TouchableOpacity
              key={val}
              onPress={() => setEventType(val)}
              style={[styles.typeBtn, eventType === val && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, eventType === val && styles.typeBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Online Event</Text>
          <Switch onValueChange={setIsOnline} value={isOnline} />
        </View>

        {isOnline ? (
          <Controller
            control={control}
            name="meetingNote"
            render={({ field: { onChange, value } }) => (
              <Input
                label="Meeting Link / Note"
                onChangeText={onChange}
                placeholder="https://... or dial-in details"
                value={value}
              />
            )}
          />
        ) : (
          <Controller
            control={control}
            name="location"
            render={({ field: { onChange, value } }) => (
              <Input label="Location" onChangeText={onChange} value={value} />
            )}
          />
        )}

        <Text style={styles.sectionTitle}>Start</Text>
        <TouchableOpacity onPress={openStartPicker} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>{startAt.toLocaleString()}</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && showStartPickerIOS ? (
          <DateTimePicker
            mode="datetime"
            onChange={(_, date) => {
              setShowStartPickerIOS(false);
              if (date) setStartAt(date);
            }}
            value={startAt}
          />
        ) : null}

        <Text style={styles.sectionTitle}>End</Text>
        <TouchableOpacity onPress={openEndPicker} style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>{endAt.toLocaleString()}</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && showEndPickerIOS ? (
          <DateTimePicker
            mode="datetime"
            onChange={(_, date) => {
              setShowEndPickerIOS(false);
              if (date) setEndAt(date);
            }}
            value={endAt}
          />
        ) : null}

        <Button fullWidth loading={saving} onPress={onSubmit} title={isEdit ? 'Save Changes' : 'Create Event'} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: spacing.xxxl },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  sectionTitle: { ...typography.h3, color: colors.text },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeBtn: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  typeBtnActive: { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
  typeBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  typeBtnTextActive: { color: colors.primary, fontWeight: '700' },
  switchRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  switchLabel: { ...typography.body, color: colors.text },
  dateBtn: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  dateBtnText: { ...typography.body, color: colors.text },
});