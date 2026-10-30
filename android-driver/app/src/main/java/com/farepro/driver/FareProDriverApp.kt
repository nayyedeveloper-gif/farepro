package com.farepro.driver

import android.app.Application
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import com.farepro.driver.meter.MeterSessionManager
import com.farepro.driver.overlay.MeterBubbleService
import com.farepro.driver.sync.TripSyncManager
import dagger.hilt.android.HiltAndroidApp
import org.osmdroid.config.Configuration
import javax.inject.Inject

@HiltAndroidApp
class FareProDriverApp : Application() {

    @Inject lateinit var meterSessionManager: MeterSessionManager
    @Inject lateinit var tripSyncManager: TripSyncManager

    override fun onCreate() {
        super.onCreate()
        Configuration.getInstance().load(
            this,
            getSharedPreferences("osmdroid", MODE_PRIVATE),
        )
        Configuration.getInstance().userAgentValue = packageName
        if (::meterSessionManager.isInitialized) {
            meterSessionManager.restoreFromDiskIfNeeded()
        }
        if (::tripSyncManager.isInitialized) {
            tripSyncManager.start()
        }

        // Overlay only when app is backgrounded (Zello-style float meter).
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                MeterBubbleService.setAppInForeground(this@FareProDriverApp, true)
            }

            override fun onStop(owner: LifecycleOwner) {
                // Refresh meter snapshot first (still foreground → no visual yet).
                if (::meterSessionManager.isInitialized) {
                    val s = meterSessionManager.state.value
                    if (s.running) {
                        MeterBubbleService.show(
                            this@FareProDriverApp,
                            s.distanceKm,
                            s.fareMmk,
                            paused = s.paused,
                        )
                    }
                }
                // Then mark background — bubble appears only now.
                MeterBubbleService.setAppInForeground(this@FareProDriverApp, false)
            }
        })
    }
}
