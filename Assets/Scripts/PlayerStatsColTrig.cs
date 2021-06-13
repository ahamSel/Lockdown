using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerStatsColTrig : MonoBehaviour
{
    private Dictionary<string, Action> powerupsCata;
    public float shieldTime, fireTime, doubleTimeTime, halveTimeTime, shrinkTime, growTime, speedUpTime, slowDownTime;
    public bool shieldOn, fireOn;

    public int playerHealth = 10;

    private PlayerMvt playerMvt;

    private Color playerColor;

    private List<float> powerupTimes;
    private Color shieldColor, fireColor, doubleTimeColor, halveTimeColor, shrinkColor, growColor, speedUpColor, slowDownColor;

    // Start is called before the first frame update
    void Start()
    {
        playerMvt = GetComponent<PlayerMvt>();

        playerColor = GetComponent<SpriteRenderer>().color;

        powerupsCata = new Dictionary<string, Action>()
        {
            { "Health", IncreasePlayerHealth },
            { "Shield", ShieldPlayer },
            { "Timex2", DoubleTimeSpeed },
            { "Time/2", HalveTimeSpeed },
            { "Raze", RazeMostBullets },
            { "Fire", PlayerBurnsBullets },
            { "Shrink", ShrinkPlayer },
            { "Grow", GrowPlayer },
            { "SpeedUp", SpeedUpPlayer },
            { "SlowDown", SlowDownPlayer },
        };

        powerupTimes = new List<float>();

        shieldColor = GameObject.Find("Shield").GetComponent<SpriteRenderer>().color;
        fireColor = GameObject.Find("Fire").GetComponent<SpriteRenderer>().color;
        shrinkColor = GameObject.Find("Shrink").GetComponent<SpriteRenderer>().color;
        growColor = GameObject.Find("Grow").GetComponent<SpriteRenderer>().color;
        speedUpColor = GameObject.Find("SpeedUp").GetComponent<SpriteRenderer>().color;
        slowDownColor = GameObject.Find("SlowDown").GetComponent<SpriteRenderer>().color;
        doubleTimeColor = GameObject.Find("Timex2").GetComponent<SpriteRenderer>().color;
        halveTimeColor = GameObject.Find("Time/2").GetComponent<SpriteRenderer>().color;
    }

    // Update is called once per frame
    void Update()
    {
        if (playerHealth < 1) Destroy(gameObject);
    }

    private void FixedUpdate()
    {
        if (shieldTime > 0) shieldTime -= Time.unscaledDeltaTime;
        else if (shieldTime < 0) ShieldOff();
         
        if (fireTime > 0) fireTime -= Time.unscaledDeltaTime;
        else if (fireTime < 0) FireOff();

        if (doubleTimeTime > 0) doubleTimeTime -= Time.unscaledDeltaTime;
        else if (doubleTimeTime < 0) NormalTimeSpeed();

        if (halveTimeTime > 0) halveTimeTime -= Time.unscaledDeltaTime;
        else if (halveTimeTime < 0) NormalTimeSpeed();

        if (speedUpTime > 0) speedUpTime -= Time.unscaledDeltaTime;
        else if (speedUpTime < 0) NormalPlayerSpeed();

        if (slowDownTime > 0) slowDownTime -= Time.unscaledDeltaTime;
        else if (slowDownTime < 0) NormalPlayerSpeed();

        if (growTime > 0) growTime -= Time.unscaledDeltaTime;
        else if (growTime < 0) NormalPlayerSize();

        if (shrinkTime > 0) shrinkTime -= Time.unscaledDeltaTime;
        else if (shrinkTime < 0) NormalPlayerSize();

        ColorSwitchHandler();
    }

    private void OnCollisionEnter2D(Collision2D col)
    {
        if (col.gameObject.CompareTag("Bullet"))
        {
            if (fireOn) Destroy(col.gameObject);
            if (!fireOn && !shieldOn) playerHealth--;
        }
    }

    private void OnTriggerEnter2D(Collider2D trig)
    {
        powerupsCata[trig.name]();
    }

    void IncreasePlayerHealth()
    {
        playerHealth += 5;
    }

    void ShieldPlayer()
    {
        fireOn = false; fireTime = 0;
        shieldOn = true;
        shieldTime += 5f;
    }

    void DoubleTimeSpeed()
    {
        halveTimeTime = 0;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 2f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime += 5f;
    }
    void HalveTimeSpeed()
    {
        doubleTimeTime = 0;
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 0.1f;
        Time.fixedDeltaTime = Time.timeScale * 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        halveTimeTime += 5f;
    }

    void RazeMostBullets()
    {
        GameObject[] bullets = GameObject.FindGameObjectsWithTag("Bullet");
        for (int i = 3; i < bullets.Length; i++)
            Destroy(bullets[i]);
    }

    void PlayerBurnsBullets()
    {
        shieldOn = false; shieldTime = 0;
        fireOn = true;
        fireTime += 5f;
    }

    void ShrinkPlayer()
    {
        growTime = 0;
        transform.localScale = new Vector2(0.2f, 0.2f);
        shrinkTime += 5f;
    }
    void GrowPlayer()
    {
        shrinkTime = 0;
        transform.localScale = new Vector2(0.8f, 0.8f);
        growTime += 5f;
    }

    void SpeedUpPlayer()
    {
        slowDownTime = 0;
        playerMvt.moveSpeed = 15f / Time.timeScale;
        speedUpTime += 5f;
    }
    void SlowDownPlayer()
    {
        speedUpTime = 0;
        playerMvt.moveSpeed = 5f / Time.timeScale;
        slowDownTime += 5f;
    }

    public void ShieldOff() {
        shieldOn = false;
        shieldTime = 0;
    }
    public void FireOff() {
        fireOn = false;
        fireTime = 0;
    }
    public void NormalPlayerSpeed() {
        playerMvt.moveSpeed = 10f / Time.timeScale;
        speedUpTime = 0;
        slowDownTime = 0;
    }
    public void NormalPlayerSize() {
        transform.localScale = new Vector2(0.5f, 0.5f);
        growTime = 0;
        shrinkTime = 0;
    }
    public void NormalTimeSpeed() {
        playerMvt.moveSpeed *= Time.timeScale;
        Time.timeScale = 1f;
        Time.fixedDeltaTime = 0.02f;
        playerMvt.moveSpeed /= Time.timeScale;
        doubleTimeTime = 0;
        halveTimeTime = 0;
    }

    void ColorSwitchHandler()
    {
        powerupTimes.Clear();
        powerupTimes.Add(shieldTime);
        powerupTimes.Add(fireTime);
        powerupTimes.Add(speedUpTime);
        powerupTimes.Add(slowDownTime);
        powerupTimes.Add(growTime);
        powerupTimes.Add(shrinkTime);
        powerupTimes.Add(doubleTimeTime);
        powerupTimes.Add(halveTimeTime);

        float maxTime = 0;
        for (int i = 0; i < powerupTimes.Count; i++)
            if (powerupTimes[i] > maxTime) maxTime = powerupTimes[i];
        if (maxTime > 0)
        {
            if (maxTime == shieldTime) GetComponent<SpriteRenderer>().color = shieldColor;
            if (maxTime == halveTimeTime) GetComponent<SpriteRenderer>().color = halveTimeColor;
            if (maxTime == slowDownTime) GetComponent<SpriteRenderer>().color = slowDownColor;
            if (maxTime == doubleTimeTime) GetComponent<SpriteRenderer>().color = doubleTimeColor;
            if (maxTime == speedUpTime) GetComponent<SpriteRenderer>().color = speedUpColor;
            if (maxTime == shrinkTime) GetComponent<SpriteRenderer>().color = shrinkColor;
            if (maxTime == fireTime) GetComponent<SpriteRenderer>().color = fireColor;
            if (maxTime == growTime) GetComponent<SpriteRenderer>().color = growColor;
        }
        else GetComponent<SpriteRenderer>().color = playerColor;
    }
}
