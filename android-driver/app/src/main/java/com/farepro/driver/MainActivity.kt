package com.farepro.driver

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.farepro.driver.presentation.navigation.DriverNavHost
import com.farepro.driver.presentation.theme.FareProTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private var openMeter by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openMeter = intent?.getBooleanExtra(EXTRA_OPEN_METER, false) == true
        enableEdgeToEdge()
        setContent {
            FareProTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    DriverNavHost(openMeter = openMeter)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openMeter = intent.getBooleanExtra(EXTRA_OPEN_METER, false)
    }

    companion object {
        const val EXTRA_OPEN_METER = "open_meter"
    }
}
