package com.pishran.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PishranBackupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
