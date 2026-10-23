#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADS1X15.h>
#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include <ESPmDNS.h>
#include <ArduinoOTA.h>

// ==========================================
// NETWORK SETTINGS
// ==========================================
const char* ssid = "Your_Wifi_SSID";     // Change to your network name
const char* password = "Your_Wifi_Password";        // Change to your password
const uint16_t websockets_port = 8765;
// ==========================================

using namespace websockets;
WebsocketsServer server;
WebsocketsClient client;

// OLED Display
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Alerts
#define RED_LED    15
#define GREEN_LED  2
#define BLUE_LED   5
#define BUZZER_PIN 4

Adafruit_MPU6050 mpu;
Adafruit_ADS1115 ads;

// Synchronized state controlled by ML Backend
String currentMLState = "IDLE";
int currentConfidence = 100;

// 1. HARDWARE SYNC FUNCTION
void updateHardwareOutputs(String state) {
  if (state == "LIVE") {
    digitalWrite(GREEN_LED, HIGH);
    digitalWrite(RED_LED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  } else if (state == "DAMAGED") {
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, HIGH);
    digitalWrite(BUZZER_PIN, HIGH);
  } else { // "IDLE" or default
    digitalWrite(GREEN_LED, LOW);
    digitalWrite(RED_LED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

bool isBackendConnected = false;

// Event callback to detect connection open / close events
void onEventsCallback(WebsocketsEvent event, String data) {
  if (event == WebsocketsEvent::ConnectionOpened) {
    isBackendConnected = true;
    digitalWrite(BLUE_LED, HIGH);
    Serial.println("✅ ML Backend connected!");
  } else if (event == WebsocketsEvent::ConnectionClosed) {
    isBackendConnected = false;
    digitalWrite(BLUE_LED, LOW);
    updateHardwareOutputs("IDLE");
    Serial.println("❌ ML Backend disconnected!");
  }
}

// 2. WEBSOCKET CALLBACK FUNCTION (Fixes the readNonBlocking error)
void onMessageCallback(WebsocketsMessage message) {
  String payload = message.data();
  // Backend sends format: "STATE:CONFIDENCE" (e.g., "LIVE:98")
  int separator = payload.indexOf(':');
  if (separator != -1) {
    currentMLState = payload.substring(0, separator);
    currentConfidence = payload.substring(separator + 1).toInt();
  } else {
    currentMLState = payload;
  }
  // Immediately update LEDs when message arrives
  updateHardwareOutputs(currentMLState);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- MAG-CIPHER TWO-WAY SYNC BOOTING ---");

  pinMode(RED_LED, OUTPUT); 
  pinMode(GREEN_LED, OUTPUT);
  pinMode(BLUE_LED, OUTPUT); 
  pinMode(BUZZER_PIN, OUTPUT);
  updateHardwareOutputs("IDLE");

  Wire.begin(21, 22);
  Wire.setClock(400000); // 400kHz Fast I2C (speeds up OLED & ADC transfers by 4x)

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println("❌ ERROR: OLED not found at 0x3C!");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Connecting WiFi...");
    display.println(ssid);
    display.display();
  }

  // Connect to Station Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  WiFi.setSleep(false); // CRITICAL: Disable modem sleep to prevent Wi-Fi latency spikes & disconnections
  
  Serial.println("\n✅ Connected to Wi-Fi!");
  Serial.print("📡 ESP32 IP: ");
  Serial.println(WiFi.localIP());

  ArduinoOTA.setHostname("Mag-Cipher-ESP32");
  ArduinoOTA.begin();

  server.listen(websockets_port);

  if (!ads.begin(0x48)) {
    Serial.println("❌ ERROR: ADS1115 not found at 0x48!");
  } else {
    ads.setGain(GAIN_ONE);
    ads.setDataRate(RATE_ADS1115_860SPS);
    Serial.println("✅ ADS1115 Initialized (860 SPS)!");
  }
  
  if (!mpu.begin(0x68)) {
    Serial.println("❌ WARNING: MPU6050 not found!");
  } else {
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("✅ MPU6050 Initialized!");
  }
}

void loop() {
  ArduinoOTA.handle();

  // Manage WebSocket Client connection
  if (server.poll()) {
    client = server.accept();
    client.onMessage(onMessageCallback); 
    client.onEvent(onEventsCallback);
    isBackendConnected = true;
    digitalWrite(BLUE_LED, HIGH);
    Serial.println("✅ ML Backend connected!");
  }

  // Keep Blue LED ON and process network packets while connected
  if (isBackendConnected) {
    client.poll(); 
    digitalWrite(BLUE_LED, HIGH); // Solid Blue LED when connected
  } else {
    digitalWrite(BLUE_LED, LOW);  // Blue LED OFF when disconnected
    updateHardwareOutputs("IDLE"); // Silence buzzer & turn off LEDs when disconnected
  }

  // HIGH SPEED PEAK-TO-PEAK SAMPLING
  // 1. Sample A0, A1, A2 for 20ms (magnetic field channels)
  float maxV0 = 0.0, minV0 = 5.0;
  float maxV1 = 0.0, minV1 = 5.0;
  float maxV2 = 0.0, minV2 = 5.0;
  unsigned long startTime = millis();
  
  while (millis() - startTime < 20) {
    float c0 = ads.computeVolts(ads.readADC_SingleEnded(0));
    float c1 = ads.computeVolts(ads.readADC_SingleEnded(1));
    float c2 = ads.computeVolts(ads.readADC_SingleEnded(2));
    
    if (c0 > maxV0) maxV0 = c0; if (c0 < minV0) minV0 = c0;
    if (c1 > maxV1) maxV1 = c1; if (c1 < minV1) minV1 = c1;
    if (c2 > maxV2) maxV2 = c2; if (c2 < minV2) minV2 = c2;
  }
  
  float p2p0 = maxV0 - minV0; 
  float p2p1 = maxV1 - minV1;
  float p2p2 = maxV2 - minV2; 

  // 2. Sample A3 (ncv) ALONE for 100ms for accurate 50Hz peak detection
  float maxV3 = 0.0, minV3 = 5.0;
  startTime = millis();
  while (millis() - startTime < 100) {
    float c3 = ads.computeVolts(ads.readADC_SingleEnded(3));
    if (c3 > maxV3) maxV3 = c3; if (c3 < minV3) minV3 = c3;
  }
  float p2p3 = maxV3 - minV3;

  // READ 3-AXIS ACCELEROMETER
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // OLED DISPLAY SYNCHRONIZATION (Updated every 150ms to prevent blocking the Wi-Fi/TCP stack)
  static unsigned long lastOledUpdate = 0;
  if (millis() - lastOledUpdate >= 150) {
    lastOledUpdate = millis();
    display.clearDisplay();
    display.setCursor(0, 0);
    
    if (currentMLState == "LIVE") {
      display.println(">> LIVE WIRE (OK) <<");
    } else if (currentMLState == "DAMAGED") {
      display.println("!! WIRE BREAK/FAULT !!");
    } else {
      display.println("-- IDLE / SCAN READY --");
    }

    display.print("ML Conf: "); display.print(currentConfidence); display.println("%");
    display.print("NCV:"); display.print(p2p3, 2); display.print("V S1:"); display.print(p2p0, 2); display.println("V");
    display.print("Tilt X:"); display.print(a.acceleration.x, 1);
    display.print(" Y:"); display.print(a.acceleration.y, 1);
    display.print(" Z:"); display.println(a.acceleration.z, 1);
    display.print("IP: "); display.println(WiFi.localIP());
    display.display();
  }

  // SEND RAW TELEMETRY TO PYTHON ML BACKEND
  String jsonPacket = "{\"s1\":" + String(p2p0, 3) + ",\"s2\":" + String(p2p1, 3) + 
                      ",\"s3\":" + String(p2p2, 3) + ",\"ncv\":" + String(p2p3, 3) + 
                      ",\"tiltX\":" + String(a.acceleration.x, 2) + 
                      ",\"tiltY\":" + String(a.acceleration.y, 2) + 
                      ",\"tiltZ\":" + String(a.acceleration.z, 2) + "}";

  if (isBackendConnected) {
    client.send(jsonPacket);
  }
}