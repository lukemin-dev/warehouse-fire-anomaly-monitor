import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Font } from './src/theme';
import { useServerData } from './src/hooks/useServerData';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { GraphScreen }     from './src/screens/GraphScreen';
import { AlertsScreen }    from './src/screens/AlertsScreen';
import { SettingsScreen }  from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  const { state, history, setThreshold } = useServerData();

  // 미확인 경고가 있으면 탭 배지 표시
  const unreadAlerts = state.alerts.length;

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor:  Colors.border,
            borderTopWidth:  1,
            height:          62,
            paddingBottom:   8,
          },
          tabBarActiveTintColor:   Colors.primary,
          tabBarInactiveTintColor: Colors.inactive,
          tabBarLabelStyle: { fontSize: Font.xs, fontWeight: '600' },
          tabBarIcon: ({ color, size, focused }) => {
            const icons: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
              Dashboard: ['home',            'home-outline'          ],
              Graph:     ['bar-chart',       'bar-chart-outline'     ],
              Alerts:    ['notifications',   'notifications-outline' ],
              Settings:  ['settings',        'settings-outline'      ],
            };
            const [active, inactive] = icons[route.name] ?? ['circle', 'circle-outline'];
            return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Dashboard" options={{ title: '대시보드' }}>
          {() => <DashboardScreen state={state} />}
        </Tab.Screen>

        <Tab.Screen name="Graph" options={{ title: '그래프' }}>
          {() => <GraphScreen history={history} mq2Threshold={state.threshold.gasThreshold} flameThreshold={state.threshold.flameThreshold} />}
        </Tab.Screen>

        <Tab.Screen
          name="Alerts"
          options={{ title: '경고', tabBarBadge: unreadAlerts > 0 ? unreadAlerts : undefined }}
        >
          {() => <AlertsScreen alerts={state.alerts} />}
        </Tab.Screen>

        <Tab.Screen name="Settings" options={{ title: '설정' }}>
          {() => <SettingsScreen />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
