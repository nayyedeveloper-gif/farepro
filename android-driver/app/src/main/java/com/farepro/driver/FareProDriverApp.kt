package com.farepro.driver

import android.app.Application
import com.farepro.driver.meter.MeterSessionManager
import dagger.hilt.android.HiltAndroidApp
import org.osmdroid.config.Configuration
import javax.inject.Inject

@HiltAndroidApp
class FareProDriverApp : Application() {

    @Inject lateinit var meterSessionManager: MeterSessionManager

    override fun onCreate() {
        super.onCreate() // Hilt field inject runs here
        Configuration.getInstance().load(
            this,
            getSharedPreferences("osmdroid", MODE_PRIVATE),
        )
        Configuration.getInstance().userAgentValue = packageName
        // After process death / cold start: resume unfinished trip GPS + bubble
        if (::meterSessionManager.isInitialized) {
            meterSessionManager.restoreFromDiskIfNeeded()
        }
    }
}
