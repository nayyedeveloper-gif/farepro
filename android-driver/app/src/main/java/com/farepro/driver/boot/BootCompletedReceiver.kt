package com.farepro.driver.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.farepro.driver.data.local.SessionStore
import com.farepro.driver.data.local.TripSessionStore
import com.farepro.driver.meter.MeterSessionManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * After reboot, resume unfinished trip GPS + floating KM until Trip Complete.
 */
@AndroidEntryPoint
class BootCompletedReceiver : BroadcastReceiver() {

    @Inject lateinit var tripSessionStore: TripSessionStore
    @Inject lateinit var sessionStore: SessionStore
    @Inject lateinit var meterSessionManager: MeterSessionManager

    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_LOCKED_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return
        }
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = sessionStore.token()
                val session = tripSessionStore.current()
                if (!token.isNullOrBlank() && session != null && session.running) {
                    meterSessionManager.resumeAfterBoot(session)
                }
            } finally {
                pending.finish()
            }
        }
    }
}
