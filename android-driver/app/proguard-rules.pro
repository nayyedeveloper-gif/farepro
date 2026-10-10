-keepattributes *Annotation*, InnerClasses, Signature
-keepclassmembers class ** {
    @kotlinx.serialization.SerialName <fields>;
}
-keep,includedescriptorclasses class com.farepro.driver.data.remote.dto.** { *; }
