using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

public class GameOver : MonoBehaviour
{
    private float timeToRestart = 3f;

    // Start is called before the first frame update
    void Start()
    {
        
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void FixedUpdate()
    {
        if (!GameObject.FindGameObjectWithTag("Player") || !GameObject.FindGameObjectWithTag("Bullet"))
            if (timeToRestart > 0) timeToRestart -= Time.unscaledDeltaTime;
            else {
                Time.timeScale = 1f;
                Time.fixedDeltaTime = 0.02f;
                SceneManager.LoadScene(SceneManager.GetActiveScene().name);
            }
    }
}
